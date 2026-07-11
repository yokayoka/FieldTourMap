import { test, expect } from "@playwright/test";

test.describe("事前ダウンロード（Requirement 3.4）", () => {
  test("ボタン操作で現在表示範囲のタイルが追加でキャッシュされ、進捗と完了が表示される", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto("/");
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 10_000 });
    await page.waitForTimeout(500);

    const cachedBefore = await page.evaluate(async () => {
      const cache = await caches.open("fieldtour-tiles-v1");
      return (await cache.keys()).length;
    });

    const button = page.locator(".precache-control__button");
    await expect(button).toBeVisible();
    await button.click();

    await expect(button).toBeDisabled();
    await expect(page.locator(".precache-control__progress")).toBeVisible();

    // ダウンロード完了までボタンが再度有効になるのを待つ。
    await expect(button).toBeEnabled({ timeout: 20_000 });
    await expect(page.locator(".precache-control__progress")).toContainText("保存しました");

    const cachedAfter = await page.evaluate(async () => {
      const cache = await caches.open("fieldtour-tiles-v1");
      return (await cache.keys()).length;
    });

    expect(cachedAfter).toBeGreaterThan(cachedBefore);
    expect(pageErrors).toEqual([]);
  });
});
