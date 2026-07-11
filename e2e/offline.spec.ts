import { test, expect } from "@playwright/test";

test.describe("オフラインタイルキャッシュ（Requirement 3）", () => {
  test("閲覧済みタイルはService Workerのキャッシュに格納される（Requirement 3.1）", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    // Service Workerが制御を開始するまで待機する。初回表示時のタイル
    // リクエストはSW有効化前に発行され得るため、制御開始後に地図を
    // わずかに動かして新規タイルリクエストを発生させてから検証する。
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 10_000 });
    await page.mouse.move(195, 400);
    await page.mouse.down();
    await page.mouse.move(150, 350, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator("img.leaflet-tile-loaded").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);

    const cachedTileCount = await page.evaluate(async () => {
      const cache = await caches.open("fieldtour-tiles-v1");
      const keys = await cache.keys();
      return keys.length;
    });

    expect(cachedTileCount).toBeGreaterThan(0);
  });

  test("オフラインで未キャッシュのタイルはグレーアウト表示となり、アプリはクラッシュしない", async ({
    page,
    context,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto("/");
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 10_000 });
    await page.waitForTimeout(1000);

    await context.setOffline(true);

    // 未閲覧の範囲へ大きくパンし、キャッシュにないタイルを要求させる。
    // bottom-controlsに隠れない画面上部をクリックしてフォーカスする。
    const map = page.locator("#map");
    await map.click({ position: { x: 195, y: 150 } });
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(50);
    }
    await page.mouse.move(200, 400);
    await page.mouse.down();
    await page.mouse.move(-4000, -4000, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(2000);

    // タイル取得失敗時もアプリ全体はクラッシュしない。
    expect(pageErrors).toEqual([]);
    await expect(page.locator(".leaflet-container")).toBeVisible();
    // レイヤーコントロール等の操作も引き続き可能であること。
    await expect(page.locator(".layer-control")).toBeVisible();
    // 未キャッシュのタイルにはグレーアウト代替表示（.tile-errorクラス）が
    // 適用されること。破損画像はPlaywrightのvisible判定ではhiddenと
    // 扱われるため、DOM上の存在（アタッチ状態）を確認する。
    await expect(page.locator("img.tile-error").first()).toBeAttached({ timeout: 5000 });

    await context.setOffline(false);
  });
});
