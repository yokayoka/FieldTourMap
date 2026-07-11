import { test, expect } from "@playwright/test";

test.describe("Admin Config Tool: ツアー編集（Requirement 4, 4.1, 4.2, 11）", () => {
  test("公開中のサンプルツアーが初期状態として読み込まれる", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto("/admin-tool/tour-editor.html");
    await page.waitForTimeout(500);

    await expect(page.locator('[name="tour-id"]')).toHaveValue("sample-tour");
    const poiSection = page.locator("section:has(h2:text('見学ポイント'))");
    const routeSection = page.locator("section:has(h2:text('巡検ルート'))");
    await expect(poiSection.locator(".simple-list-view__item")).toHaveCount(2);
    await expect(routeSection.locator(".simple-list-view__item")).toHaveCount(1);

    expect(pageErrors).toEqual([]);
  });

  test("地図タップでPOIを追加し、メディア・参考論文リンクを保存できる", async ({ page }) => {
    await page.goto("/admin-tool/tour-editor.html");
    await page.waitForTimeout(500);

    await page.locator(".map-mode-toolbar__add-poi").click();
    await expect(page.locator(".map-mode-toolbar__add-poi")).toHaveClass(
      /map-mode-toolbar__add-poi--active/,
    );

    await page.locator("#tour-preview-map").click({ position: { x: 200, y: 200 } });
    await expect(page.locator(".poi-editor-form")).toBeVisible();
    // タップと同時にモードは自動解除される。
    await expect(page.locator(".map-mode-toolbar__add-poi")).not.toHaveClass(
      /map-mode-toolbar__add-poi--active/,
    );

    await page.fill(".poi-editor-form [name=\"name\"]", "新しい露頭");
    await page.fill(".poi-editor-form [name=\"description\"]", "テスト用の説明文");

    await page.locator(".poi-editor-form__media-add").click();
    const mediaRow = page.locator(".poi-editor-form__media .link-list-editor__row").first();
    await mediaRow.locator(".link-list-editor__url").fill("https://drive.example.com/photo1");
    await mediaRow.locator(".link-list-editor__label").fill("露頭全景");

    await page.locator(".poi-editor-form__paper-add").click();
    const paperRow = page.locator(".poi-editor-form__papers .link-list-editor__row").first();
    await paperRow.locator(".link-list-editor__url").fill("https://doi.example.com/paper1");
    await paperRow.locator(".link-list-editor__label").fill("山田 (2024)");

    await page.locator(".poi-editor-form__save").click();
    await expect(page.locator(".poi-editor-form")).toBeHidden();

    const poiList = page.locator("section:has(h2:text('見学ポイント')) .simple-list-view__item");
    await expect(poiList).toHaveCount(3);
    await expect(poiList.last()).toContainText("新しい露頭");
  });

  test("地図タップを複数回行いルートを作成できる", async ({ page }) => {
    await page.goto("/admin-tool/tour-editor.html");
    await page.waitForTimeout(500);

    await page.locator(".map-mode-toolbar__add-route").click();
    const map = page.locator("#tour-preview-map");
    await map.click({ position: { x: 150, y: 150 } });
    await map.click({ position: { x: 200, y: 200 } });
    await map.click({ position: { x: 250, y: 180 } });

    await expect(page.locator(".map-mode-toolbar__finish-route")).toBeEnabled();
    await page.locator(".map-mode-toolbar__finish-route").click();

    await expect(page.locator(".route-editor-form")).toBeVisible();
    await expect(page.locator(".route-editor-form__point-count")).toContainText("3");

    await page.fill(".route-editor-form [name=\"name\"]", "新しい巡検ルート");
    await page.locator(".route-editor-form__save").click();

    await expect(page.locator(".route-editor-form")).toBeHidden();
    const routeList = page.locator("section:has(h2:text('巡検ルート')) .simple-list-view__item");
    await expect(routeList).toHaveCount(2);
    await expect(routeList.last()).toContainText("新しい巡検ルート");
  });

  test("既存POIを編集・削除できる", async ({ page }) => {
    await page.goto("/admin-tool/tour-editor.html");
    await page.waitForTimeout(500);

    const poiSection = page.locator("section:has(h2:text('見学ポイント'))");
    await poiSection.locator(".simple-list-view__edit").first().click();

    const nameInput = page.locator('.poi-editor-form [name="name"]');
    await expect(nameInput).toHaveValue("露頭A（花崗岩貫入部）");
    await nameInput.fill("露頭A（編集後）");
    await page.locator(".poi-editor-form__save").click();

    await expect(poiSection.locator(".simple-list-view__item").first()).toContainText(
      "露頭A（編集後）",
    );

    await poiSection.locator(".simple-list-view__delete").first().click();
    await expect(poiSection.locator(".simple-list-view__item")).toHaveCount(1);
  });

  test("tours/*.jsonをダウンロードできる", async ({ page }) => {
    await page.goto("/admin-tool/tour-editor.html");
    await page.waitForTimeout(500);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".admin-toolbar__export").click(),
    ]);

    expect(download.suggestedFilename()).toBe("sample-tour.json");
  });
});
