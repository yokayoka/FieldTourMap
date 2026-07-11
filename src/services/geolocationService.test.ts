import { describe, expect, it, vi } from "vitest";
import { GeolocationService, type GeolocationApiLike } from "./geolocationService";

function createFakeGeolocation(): GeolocationApiLike & {
  successHandler?: (position: GeolocationPosition) => void;
  errorHandler?: (error: GeolocationPositionError) => void;
} {
  let nextWatchId = 1;
  const fake: ReturnType<typeof createFakeGeolocation> = {
    watchPosition: vi.fn((onSuccess, onError) => {
      fake.successHandler = onSuccess;
      fake.errorHandler = onError;
      return nextWatchId++;
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
    [99, /不明なエラー/],
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

    expect(geolocation.clearWatch).toHaveBeenCalledWith(1);
    expect(orientationTarget.removeEventListener).toHaveBeenCalledWith(
      "deviceorientation",
      expect.any(Function),
    );
  });

  it("cleans up the previous watch/listener when startWatching is called again (re-entrancy safety)", () => {
    const geolocation = createFakeGeolocation();
    const orientationTarget = createFakeOrientationTarget();
    const service = new GeolocationService({ geolocation, orientationTarget });

    service.startWatching(vi.fn(), vi.fn());
    service.startWatching(vi.fn(), vi.fn());

    // 1回目のwatchPosition呼び出しが返したID(1)がクリアされていること。
    expect(geolocation.clearWatch).toHaveBeenCalledWith(1);
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(2);
    expect(orientationTarget.removeEventListener).toHaveBeenCalledTimes(1);
    expect(orientationTarget.addEventListener).toHaveBeenCalledTimes(2);
  });

  it("throttles rapid orientation updates using the injected clock", () => {
    const geolocation = createFakeGeolocation();
    const orientationTarget = createFakeOrientationTarget();
    let currentTime = 0;
    const service = new GeolocationService({
      geolocation,
      orientationTarget,
      now: () => currentTime,
    });
    const onUpdate = vi.fn();

    service.startWatching(onUpdate, vi.fn());
    geolocation.successHandler?.(fakePosition(35.68, 139.76, 12));
    onUpdate.mockClear();

    orientationTarget.fire("deviceorientation", { webkitCompassHeading: 10, alpha: null });
    currentTime += 50; // スロットル窓内
    orientationTarget.fire("deviceorientation", { webkitCompassHeading: 20, alpha: null });

    expect(onUpdate).toHaveBeenCalledTimes(1);

    currentTime += 300; // スロットル窓を超過
    orientationTarget.fire("deviceorientation", { webkitCompassHeading: 30, alpha: null });

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith({
      lat: 35.68,
      lng: 139.76,
      accuracy: 12,
      heading: 30,
    });
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

  describe("iOS 13+ Safari: DeviceOrientationEvent.requestPermission gating", () => {
    // iOS 13以降のSafariでは、ユーザー操作（タップ等）内から明示的に
    // DeviceOrientationEvent.requestPermission()を呼び出さない限り
    // deviceorientationイベントは一切発火しない。startWatching()は
    // ページ読み込み時に自動実行されユーザー操作の文脈にないため、
    // このAPIが存在する場合はリスナーの自動アタッチを見送り、
    // requestOrientationPermission()（呼び出し側がボタンのクリック
    // ハンドラ等、ユーザー操作の文脈から呼ぶ）を待つ必要がある。
    function createFakePermissionApi(result: "granted" | "denied" | Error) {
      return {
        requestPermission: vi.fn(() =>
          result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
        ),
      };
    }

    it("does not attach the orientation listener automatically when a permission API is present", () => {
      const geolocation = createFakeGeolocation();
      const orientationTarget = createFakeOrientationTarget();
      const orientationPermissionApi = createFakePermissionApi("granted");
      const service = new GeolocationService({ geolocation, orientationTarget, orientationPermissionApi });

      service.startWatching(vi.fn(), vi.fn());

      expect(orientationTarget.addEventListener).not.toHaveBeenCalled();
    });

    it("attaches the listener once the user grants permission via requestOrientationPermission()", async () => {
      const geolocation = createFakeGeolocation();
      const orientationTarget = createFakeOrientationTarget();
      const orientationPermissionApi = createFakePermissionApi("granted");
      const service = new GeolocationService({ geolocation, orientationTarget, orientationPermissionApi });
      const onUpdate = vi.fn();

      service.startWatching(onUpdate, vi.fn());
      await service.requestOrientationPermission();

      expect(orientationPermissionApi.requestPermission).toHaveBeenCalled();
      expect(orientationTarget.addEventListener).toHaveBeenCalledWith(
        "deviceorientation",
        expect.any(Function),
      );

      geolocation.successHandler?.(fakePosition(35.68, 139.76, 12));
      orientationTarget.fire("deviceorientation", { webkitCompassHeading: 45, alpha: null });
      expect(onUpdate).toHaveBeenLastCalledWith({
        lat: 35.68,
        lng: 139.76,
        accuracy: 12,
        heading: 45,
      });
    });

    it("does not attach the listener when the user denies permission", async () => {
      const geolocation = createFakeGeolocation();
      const orientationTarget = createFakeOrientationTarget();
      const orientationPermissionApi = createFakePermissionApi("denied");
      const service = new GeolocationService({ geolocation, orientationTarget, orientationPermissionApi });

      service.startWatching(vi.fn(), vi.fn());
      await service.requestOrientationPermission();

      expect(orientationTarget.addEventListener).not.toHaveBeenCalled();
    });

    it("does not throw when the permission prompt itself rejects", async () => {
      const geolocation = createFakeGeolocation();
      const orientationTarget = createFakeOrientationTarget();
      const orientationPermissionApi = createFakePermissionApi(new Error("prompt blocked"));
      const service = new GeolocationService({ geolocation, orientationTarget, orientationPermissionApi });

      service.startWatching(vi.fn(), vi.fn());

      await expect(service.requestOrientationPermission()).resolves.not.toThrow();
      expect(orientationTarget.addEventListener).not.toHaveBeenCalled();
    });

    it("is a no-op on platforms that don't require the permission (e.g. Android Chrome)", async () => {
      const geolocation = createFakeGeolocation();
      const orientationTarget = createFakeOrientationTarget();
      const service = new GeolocationService({ geolocation, orientationTarget });

      service.startWatching(vi.fn(), vi.fn());
      // Androidでは既にstartWatching()時点でリスナーがアタッチ済み。
      expect(orientationTarget.addEventListener).toHaveBeenCalledTimes(1);

      await service.requestOrientationPermission();

      // 二重にアタッチされないこと。
      expect(orientationTarget.addEventListener).toHaveBeenCalledTimes(1);
    });
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
