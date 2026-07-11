import { test, expect } from "@playwright/test";

test.describe("現在地表示（Requirement 1、位置情報許可あり）", () => {
  test.use({
    permissions: ["geolocation"],
    geolocation: { latitude: 35.6895, longitude: 139.6917, accuracy: 15 },
  });

  test("現在地マーカーが表示され、エラーは表示されない", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".location-marker")).toBeVisible();
    await expect(page.locator(".location-control__error")).toBeHidden();
  });

  test("追従モードのON/OFFを切り替えられる（Requirement 1.5）", async ({ page }) => {
    await page.goto("/");

    const followButton = page.locator(".location-control__button");
    await expect(followButton).toHaveClass(/location-control__button--active/);

    await followButton.click();
    await expect(followButton).not.toHaveClass(/location-control__button--active/);
  });
});

test.describe("現在地表示（Requirement 1.4、位置情報許可なし）", () => {
  test("エラーメッセージが表示され、地図・レイヤー操作は継続できる", async ({ page }) => {
    await page.addInitScript(() => {
      // 位置情報が許可されなかった状況を再現する。
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          watchPosition: (
            _onSuccess: PositionCallback,
            onError?: PositionErrorCallback,
          ) => {
            onError?.({
              code: 1,
              message: "denied",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
            return 1;
          },
          clearWatch: () => {},
        },
      });
    });

    await page.goto("/");

    const errorBanner = page.locator(".location-control__error");
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText("許可されていません");

    // 地図・レイヤー操作は引き続き行えること（Requirement 1.4）
    const osmButton = page.getByRole("radio", { name: "OpenStreetMap" });
    await osmButton.click();
    await expect(osmButton).toHaveClass(/layer-control__button--active/);
  });
});
