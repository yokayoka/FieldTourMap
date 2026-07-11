import { describe, expect, it, vi } from "vitest";
import { GeolocationService, type GeolocationApiLike } from "./geolocationService";

function createFakeGeolocation(): GeolocationApiLike & {
  successHandler?: (position: GeolocationPosition) => void;
  errorHandler?: (error: GeolocationPositionError) => void;
} {
  const fake: ReturnType<typeof createFakeGeolocation> = {
    watchPosition: vi.fn((onSuccess, onError) => {
      fake.successHandler = onSuccess;
      fake.errorHandler = onError;
      return 42;
    }),
    clearWatch: vi.fn(),
  };
  return fake;
}

function createFakeOrientationTarget() {
  const listeners = new Map<string, (event: unknown) => void>();
  return {
    addEventListener: vi.fn((type: string, handler: (event: unknown) => void) => {
      listeners.set(type, handler);
    }),
    removeEventListener: vi.fn((type: string) => {
      listeners.delete(type);
    }),
    fire(type: string, event: unknown) {
      listeners.get(type)?.(event);
    },
  };
}

function fakePosition(lat: number, lng: number, accuracy: number): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy,
      heading: null,
      altitude: null,
      altitudeAccuracy: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  } as GeolocationPosition;
}

function fakeError(code: number): GeolocationPositionError {
  return { code, message: "error", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError;
}

describe("GeolocationService", () => {
  it("starts watching position with high accuracy enabled", () => {
    const geolocation = createFakeGeolocation();
    const orientationTarget = createFakeOrientationTarget();
    const service = new GeolocationService({ geolocation, orientationTarget });

    service.startWatching(vi.fn(), vi.fn());

    expect(geolocation.watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true }),
    );
  });

  it("reports a position update with null heading before any orientation event", () => {
    const geolocation = createFakeGeolocation();
    const orientationTarget = createFakeOrientationTarget();
    const service = new GeolocationService({ geolocation, orientationTarget });
    const onUpdate = vi.fn();

    service.startWatching(onUpdate, vi.fn());
    geolocation.successHandler?.(fakePosition(35.68, 139.76, 12));

    expect(onUpdate).toHaveBeenCalledWith({ lat: 35.68, lng: 139.76, accuracy: 12, heading: null });
  });

  it("merges webkitCompassHeading from a device orientation event into the next update", () => {
    const geolocation = createFakeGeolocation();
    const orientationTarget = createFakeOrientationTarget();
    const service = new GeolocationService({ geolocation, orientationTarget });
    const onUpdate = vi.fn();

    service.startWatching(onUpdate, vi.fn());
    geolocation.successHandler?.(fakePosition(35.68, 139.76, 12));
    orientationTarget.fire("deviceorientation", { webkitCompassHeading: 123, alpha: null });

    expect(onUpdate).toHaveBeenLastCalledWith({
      lat: 35.68,
      lng: 139.76,
      accuracy: 12,
      heading: 123,
    });
  });

  it("computes heading from absolute alpha when webkitCompassHeading is unavailable", () => {
    const geolocation = createFakeGeolocation();
    const orientationTarget = createFakeOrientationTarget();
    const service = new GeolocationService({ geolocation, orientationTarget });
    const onUpdate = vi.fn();

    service.startWatching(onUpdate, vi.fn());
    geolocation.successHandler?.(fakePosition(35.68, 139.76, 12));
    orientationTarget.fire("deviceorientation", { absolute: true, alpha: 90 });

    expect(onUpdate).toHaveBeenLastCalledWith({
      lat: 35.68,
      lng: 139.76,
      accuracy: 12,
      heading: 270,
    });
  });

  it("ignores orientation events that provide no usable heading", () => {
    const geolocation = createFakeGeolocation();
    const orientationTarget = createFakeOrientationTarget();
    const service = new GeolocationService({ geolocation, orientationTarget });
    const onUpdate = vi.fn();

    service.startWatching(onUpdate, vi.fn());
    orientationTarget.fire("deviceorientation", { absolute: false, alpha: 90 });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it.each([
    [1, /許可/],
    [2, /取得できません/],
    [3, /タイムアウト/],
  ])("maps geolocation error code %i to a Japanese message matching %s", (code, pattern) => {
    const geolocation = createFakeGeolocation();
    const orientationTarget = createFakeOrientationTarget();
    const service = new GeolocationService({ geolocation, orientationTarget });
    const onError = vi.fn();

    service.startWatching(vi.fn(), onError);
    geolocation.errorHandler?.(fakeError(code));

    expect(onError).toHaveBeenCalledWith(expect.stringMatching(pattern));
  });

  it("stops watching position and removes the orientation listener", () => {
    const geolocation = createFakeGeolocation();
    const orientationTarget = createFakeOrientationTarget();
    const service = new GeolocationService({ geolocation, orientationTarget });

    service.startWatching(vi.fn(), vi.fn());
    service.stopWatching();

    expect(geolocation.clearWatch).toHaveBeenCalledWith(42);
    expect(orientationTarget.removeEventListener).toHaveBeenCalledWith(
      "deviceorientation",
      expect.any(Function),
    );
  });

  it("defaults follow mode to enabled and toggles it", () => {
    const geolocation = createFakeGeolocation();
    const orientationTarget = createFakeOrientationTarget();
    const service = new GeolocationService({ geolocation, orientationTarget });

    expect(service.isFollowModeEnabled()).toBe(true);

    service.setFollowMode(false);
    expect(service.isFollowModeEnabled()).toBe(false);
  });

  it("reports an error immediately when geolocation is unsupported", () => {
    const orientationTarget = createFakeOrientationTarget();
    const service = new GeolocationService({ geolocation: undefined, orientationTarget });
    const onError = vi.fn();

    service.startWatching(vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/対応していません/));
  });

  it("falls back to navigator.geolocation when no geolocation option is supplied", () => {
    const navigatorGeolocation = createFakeGeolocation();
    vi.stubGlobal("navigator", { ...globalThis.navigator, geolocation: navigatorGeolocation });

    const orientationTarget = createFakeOrientationTarget();
    const service = new GeolocationService({ orientationTarget });
    const onError = vi.fn();

    service.startWatching(vi.fn(), onError);

    expect(navigatorGeolocation.watchPosition).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
