import { test, expect } from "@playwright/test";

test.describe("レスポンシブレイアウト（Requirement 6）", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("360px幅で横スクロールが発生せず、タップ対象は44px以上を確保する", async ({ page }) => {
    await page.goto("/");

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    const sizes = await page.$$eval(
      ".layer-control__button, .layer-control__checkbox-label, .location-control__button",
      (elements) => elements.map((el) => el.getBoundingClientRect()),
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const rect of sizes) {
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("現在地ボタンとレイヤーパネルが重ならない", async ({ page }) => {
    await page.goto("/");

    const locationRect = await page.locator(".location-control").boundingBox();
    const layerRect = await page.locator(".layer-control").boundingBox();
    expect(locationRect).not.toBeNull();
    expect(layerRect).not.toBeNull();

    const overlap = !(
      locationRect!.y + locationRect!.height <= layerRect!.y ||
      layerRect!.y + layerRect!.height <= locationRect!.y
    );
    expect(overlap).toBe(false);
  });
});
