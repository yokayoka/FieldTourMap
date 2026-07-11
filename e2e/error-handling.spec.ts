import { test, expect } from "@playwright/test";

test.describe("致命的な設定読み込み失敗時のフォールバック", () => {
  test("layers.jsonの取得に失敗した場合、真っ白な画面ではなくエラーメッセージを表示する", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.route("**/config/layers.json", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );

    await page.goto("/");

    const banner = page.locator(".app-error-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("初期化に失敗しました");

    // 未捕捉のページエラー（unhandled rejection由来のクラッシュ表示）が
    // 発生していないこと。
    expect(pageErrors).toEqual([]);
  });
});
