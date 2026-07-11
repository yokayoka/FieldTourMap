export interface GeolocationApiLike {
  watchPosition(
    onSuccess: (position: GeolocationPosition) => void,
    onError?: (error: GeolocationPositionError) => void,
    options?: PositionOptions,
  ): number;
  clearWatch(id: number): void;
}

export interface OrientationEventLike {
  absolute?: boolean;
  alpha: number | null;
  webkitCompassHeading?: number;
}

export interface OrientationTargetLike {
  addEventListener(type: "deviceorientation", handler: (event: OrientationEventLike) => void): void;
  removeEventListener(type: "deviceorientation", handler: (event: OrientationEventLike) => void): void;
}

export interface GeolocationUpdate {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
}

export interface GeolocationServiceOptions {
  geolocation?: GeolocationApiLike;
  orientationTarget?: OrientationTargetLike;
}

function extractHeading(event: OrientationEventLike): number | null {
  if (typeof event.webkitCompassHeading === "number") {
    return event.webkitCompassHeading;
  }
  if (event.absolute === true && typeof event.alpha === "number") {
    return (360 - event.alpha) % 360;
  }
  return null;
}

function mapErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case 1:
      return "位置情報の利用が許可されていません。ブラウザの設定を確認してください。";
    case 2:
      return "現在地を取得できませんでした。電波状況の良い場所でお試しください。";
    case 3:
      return "現在地の取得がタイムアウトしました。もう一度お試しください。";
    default:
      return "現在地の取得中に不明なエラーが発生しました。";
  }
}

export class GeolocationService {
  private readonly geolocation?: GeolocationApiLike;
  private readonly orientationTarget: OrientationTargetLike;

  private watchId: number | null = null;
  private orientationHandler: ((event: OrientationEventLike) => void) | null = null;
  private lastPosition: { lat: number; lng: number; accuracy: number } | null = null;
  private lastHeading: number | null = null;
  private followMode = true;

  constructor(options: GeolocationServiceOptions = {}) {
    this.geolocation =
      options.geolocation ?? (typeof navigator !== "undefined" ? navigator.geolocation : undefined);
    this.orientationTarget = options.orientationTarget ?? window;
  }

  startWatching(onUpdate: (update: GeolocationUpdate) => void, onError: (message: string) => void): void {
    if (!this.geolocation) {
      onError("このブラウザは位置情報取得に対応していません。");
      return;
    }

    this.watchId = this.geolocation.watchPosition(
      (position) => {
        this.lastPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        onUpdate({ ...this.lastPosition, heading: this.lastHeading });
      },
      (error) => onError(mapErrorMessage(error)),
      { enableHighAccuracy: true },
    );

    this.orientationHandler = (event) => {
      const heading = extractHeading(event);
      if (heading === null || !this.lastPosition) return;
      this.lastHeading = heading;
      onUpdate({ ...this.lastPosition, heading });
    };
    this.orientationTarget.addEventListener("deviceorientation", this.orientationHandler);
  }

  stopWatching(): void {
    if (this.watchId !== null) {
      this.geolocation?.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.orientationHandler) {
      this.orientationTarget.removeEventListener("deviceorientation", this.orientationHandler);
      this.orientationHandler = null;
    }
  }

  setFollowMode(enabled: boolean): void {
    this.followMode = enabled;
  }

  isFollowModeEnabled(): boolean {
    return this.followMode;
  }
}
