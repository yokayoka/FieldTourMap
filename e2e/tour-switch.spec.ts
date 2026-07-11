import { test, expect } from "@playwright/test";

test.describe("複数実習ツアー切替（Requirement 20）", () => {
  test("初期表示は一覧先頭のツアーで、切替パネルに全ツアーが表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    await expect(page.locator(".tour-selector-control__button")).toHaveText("サンプル巡検コース");

    await page.locator(".tour-selector-control__button").click();
    const items = page.locator(".tour-selector-panel__item");
    await expect(items).toHaveCount(2);
    await expect(items.filter({ hasText: "サンプル巡検コース" })).toHaveClass(
      /tour-selector-panel__item--active/,
    );
  });

  test("別のツアーを選択するとPOIとレイヤー構成の提案が切り替わる", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    await page.locator(".tour-selector-control__button").click();
    await page.locator(".tour-selector-panel__item", { hasText: "第二巡検コース" }).click();

    await expect(page.locator(".tour-selector-control__button")).toHaveText(
      "第二巡検コース（海岸地形）",
    );
    await expect(page.locator(".tour-selector-panel")).toBeHidden();

    // 第二巡検コースのlayerIdsは["osm", "gsi-photo"]なので、最初に見つかる
    // baseレイヤー（osm）が提案として自動選択される。
    await expect(page.getByRole("radio", { name: "OpenStreetMap" })).toHaveClass(
      /layer-control__button--active/,
    );

    const marker = page.locator(".leaflet-marker-icon:not(.location-marker)").first();
    await marker.click();
    await expect(page.locator(".poi-detail-panel__title")).toHaveText("露頭C（海岸段丘）");
  });

  test("選択したツアーはリロード後も保持される", async ({ page }) => {
    await page.goto("/");
    await page.locator(".tour-selector-control__button").click();
    await page.locator(".tour-selector-panel__item", { hasText: "第二巡検コース" }).click();
    await expect(page.locator(".tour-selector-control__button")).toHaveText(
      "第二巡検コース（海岸地形）",
    );

    await page.reload();
    await expect(page.locator(".tour-selector-control__button")).toHaveText(
      "第二巡検コース（海岸地形）",
    );
  });

  test("共有URLはツアーIDを含み、受信側で同じツアー・POIが復元される", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/");
    await page.locator(".tour-selector-control__button").click();
    await page.locator(".tour-selector-panel__item", { hasText: "第二巡検コース" }).click();

    const marker = page.locator(".leaflet-marker-icon:not(.location-marker)").first();
    await marker.click();
    await expect(page.locator(".poi-detail-panel__title")).toHaveText("露頭C（海岸段丘）");

    await page.locator(".share-control__button").click();
    const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(sharedUrl).toContain("tour=second-tour");
    expect(sharedUrl).toContain("poi=poi-101");

    const otherContext = await page.context().browser()!.newContext();
    const otherPage = await otherContext.newPage();
    await otherPage.goto(sharedUrl);
    await expect(otherPage.locator(".tour-selector-control__button")).toHaveText(
      "第二巡検コース（海岸地形）",
    );
    await expect(otherPage.locator(".poi-detail-panel__title")).toHaveText("露頭C（海岸段丘）");
    await otherContext.close();
  });
});
