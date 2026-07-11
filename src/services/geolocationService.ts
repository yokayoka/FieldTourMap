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

export interface OrientationPermissionApiLike {
  requestPermission(): Promise<"granted" | "denied">;
}

export interface GeolocationServiceOptions {
  geolocation?: GeolocationApiLike;
  orientationTarget?: OrientationTargetLike;
  orientationPermissionApi?: OrientationPermissionApiLike;
  now?: () => number;
}

// iOS 13以降のSafariは、DeviceOrientationEventコンストラクタに
// requestPermission()静的メソッドを追加しており、ユーザー操作の文脈内で
// これを呼び出し許可を得ない限りdeviceorientationイベントを一切発火しない
// （Android Chrome等にはこの制約はない）。
function defaultOrientationPermissionApi(): OrientationPermissionApiLike | undefined {
  if (typeof DeviceOrientationEvent === "undefined") return undefined;
  const ctor = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<"granted" | "denied">;
  };
  if (typeof ctor.requestPermission !== "function") return undefined;
  return { requestPermission: () => ctor.requestPermission!() };
}

// deviceorientationは端末によって最大60Hz程度で発火しうるため、
// map.setView()等の再レイアウトを伴う更新頻度を抑制する（Requirement 1.3）。
const HEADING_UPDATE_THROTTLE_MS = 250;

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
  private readonly orientationPermissionApi?: OrientationPermissionApiLike;
  private readonly now: () => number;

  private watchId: number | null = null;
  private orientationHandler: ((event: OrientationEventLike) => void) | null = null;
  private orientationListenerAttached = false;
  private lastPosition: { lat: number; lng: number; accuracy: number } | null = null;
  private lastHeading: number | null = null;
  private lastHeadingUpdateAt: number | null = null;
  private followMode = true;

  constructor(options: GeolocationServiceOptions = {}) {
    this.geolocation =
      options.geolocation ?? (typeof navigator !== "undefined" ? navigator.geolocation : undefined);
    this.orientationTarget = options.orientationTarget ?? window;
    this.orientationPermissionApi =
      options.orientationPermissionApi ?? defaultOrientationPermissionApi();
    this.now = options.now ?? Date.now;
  }

  startWatching(onUpdate: (update: GeolocationUpdate) => void, onError: (message: string) => void): void {
    // 再入時に前回のwatch/リスナーが残り続けないようにする（再入安全性）。
    this.stopWatching();

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

      const now = this.now();
      if (
        this.lastHeadingUpdateAt !== null &&
        now - this.lastHeadingUpdateAt < HEADING_UPDATE_THROTTLE_MS
      ) {
        return;
      }
      this.lastHeadingUpdateAt = now;
      this.lastHeading = heading;
      onUpdate({ ...this.lastPosition, heading });
    };

    // iOS 13+ Safariではユーザー操作の文脈内でrequestPermission()を経る
    // までdeviceorientationは発火しないため、ここでは自動アタッチしない。
    // 呼び出し側がユーザー操作ハンドラからrequestOrientationPermission()
    // を呼ぶ必要がある（Android Chrome等、APIが存在しない環境では従来
    // 通り即座にアタッチする）。
    if (!this.orientationPermissionApi) {
      this.orientationTarget.addEventListener("deviceorientation", this.orientationHandler);
      this.orientationListenerAttached = true;
    }
  }

  /**
   * iOS 13+ Safariでの方位取得許可をリクエストする。ボタンのクリック
   * ハンドラ等、ユーザー操作の文脈から呼び出す必要がある。許可が不要な
   * 環境（Android Chrome等）やstartWatching()未実行時は何もしない。
   */
  async requestOrientationPermission(): Promise<void> {
    if (!this.orientationPermissionApi || this.orientationListenerAttached || !this.orientationHandler) {
      return;
    }
    try {
      const result = await this.orientationPermissionApi.requestPermission();
      if (result === "granted" && this.orientationHandler) {
        this.orientationTarget.addEventListener("deviceorientation", this.orientationHandler);
        this.orientationListenerAttached = true;
      }
    } catch (error) {
      console.warn("方位取得の許可リクエストに失敗しました", error);
    }
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
    this.orientationListenerAttached = false;
  }

  setFollowMode(enabled: boolean): void {
    this.followMode = enabled;
  }

  isFollowModeEnabled(): boolean {
    return this.followMode;
  }
}
