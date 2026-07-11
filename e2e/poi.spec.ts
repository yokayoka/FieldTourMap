import { test, expect } from "@playwright/test";

test.describe("POI詳細パネル（Requirement 4, 4.1, 4.2）", () => {
  test("マーカータップで詳細が表示され、メディアと参考文献が別セクションで表示される", async ({
    page,
  }) => {
    await page.goto("/");

    const marker = page.locator(".leaflet-marker-icon:not(.location-marker)").first();
    await marker.click();

    const panel = page.locator(".poi-detail-panel");
    await expect(panel).toBeVisible();
    await expect(panel.locator(".poi-detail-panel__title")).toHaveText("露頭A（花崗岩貫入部）");

    const mediaSection = panel.locator(".poi-detail-panel__media");
    await expect(mediaSection).toContainText("メディア");

    const paperSection = panel.locator(".poi-detail-panel__papers");
    await expect(paperSection).toContainText("参考文献");

    const mediaLink = mediaSection.locator("a").first();
    await expect(mediaLink).toHaveAttribute("target", "_blank");
    await expect(mediaLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("閉じるボタンでパネルが閉じる", async ({ page }) => {
    await page.goto("/");

    const marker = page.locator(".leaflet-marker-icon:not(.location-marker)").first();
    await marker.click();
    await expect(page.locator(".poi-detail-panel")).toBeVisible();

    await page.locator(".poi-detail-panel__close").click();
    await expect(page.locator(".poi-detail-panel")).toBeHidden();
  });
});
