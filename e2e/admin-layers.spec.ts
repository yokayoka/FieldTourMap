import { test, expect } from "@playwright/test";

test.describe("Admin Config Tool: レイヤー編集（Requirement 11, 10）", () => {
  test("公開中のlayers.jsonが初期状態として読み込まれ、一覧表示される", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto("/admin-tool/");

    const items = page.locator(".layer-list-view__item");
    await expect(items).toHaveCount(4);
    await expect(items.first()).toContainText("地理院地図（標準地図）");

    expect(pageErrors).toEqual([]);
  });

  test("新規レイヤーを追加すると一覧に反映される", async ({ page }) => {
    await page.goto("/admin-tool/");
    await expect(page.locator(".layer-list-view__item")).toHaveCount(4);

    await page.locator(".layer-list-view__add").click();
    await expect(page.locator(".layer-editor-form")).toBeVisible();

    await page.fill('.layer-editor-form [name="id"]', "test-layer");
    await page.fill('.layer-editor-form [name="name"]', "テストレイヤー");
    await page.fill(
      '.layer-editor-form [name="urlTemplate"]',
      "https://example.com/{z}/{x}/{y}.png",
    );
    await page.fill('.layer-editor-form [name="attribution"]', "テスト帰属表示");
    await page.fill('.layer-editor-form [name="opacity"]', "1");
    await page.fill('.layer-editor-form [name="minZoom"]', "0");
    await page.fill('.layer-editor-form [name="maxZoom"]', "18");

    await page.locator(".layer-editor-form__save").click();

    await expect(page.locator(".layer-editor-form")).toBeHidden();
    await expect(page.locator(".layer-list-view__item")).toHaveCount(5);
    await expect(page.locator(".layer-list-view__item").last()).toContainText("テストレイヤー");
  });

  test("不正なタイルURL（プレースホルダ欠落）は保存が拒否されエラーが表示される（Requirement 11.4）", async ({
    page,
  }) => {
    await page.goto("/admin-tool/");
    await page.locator(".layer-list-view__add").click();

    await page.fill('.layer-editor-form [name="id"]', "broken-layer");
    await page.fill('.layer-editor-form [name="name"]', "壊れたレイヤー");
    await page.fill('.layer-editor-form [name="urlTemplate"]', "https://example.com/{z}/{x}.png");
    await page.fill('.layer-editor-form [name="attribution"]', "テスト");
    await page.fill('.layer-editor-form [name="opacity"]', "1");
    await page.fill('.layer-editor-form [name="minZoom"]', "0");
    await page.fill('.layer-editor-form [name="maxZoom"]', "18");

    const itemCountBefore = await page.locator(".layer-list-view__item").count();
    await page.locator(".layer-editor-form__save").click();

    await expect(page.locator(".layer-editor-form")).toBeVisible();
    await expect(page.locator(".layer-editor-form__errors")).toContainText("{y}");
    await expect(page.locator(".layer-list-view__item")).toHaveCount(itemCountBefore);
  });

  test("既存レイヤーを編集・削除できる", async ({ page }) => {
    await page.goto("/admin-tool/");
    const firstItem = page.locator(".layer-list-view__item").first();
    await firstItem.locator(".layer-list-view__edit").click();

    const nameInput = page.locator('.layer-editor-form [name="name"]');
    await expect(nameInput).toHaveValue("地理院地図（標準地図）");
    await nameInput.fill("地理院地図（編集後）");
    await page.locator(".layer-editor-form__save").click();

    await expect(page.locator(".layer-list-view__item").first()).toContainText(
      "地理院地図（編集後）",
    );

    await page.locator(".layer-list-view__item").first().locator(".layer-list-view__delete").click();
    await expect(page.locator(".layer-list-view__item")).toHaveCount(3);
  });

  test("プレビューボタンで地図上にタイルが表示される（Requirement 11.5）", async ({ page }) => {
    await page.goto("/admin-tool/");
    await page.locator(".layer-list-view__add").click();

    await page.fill('.layer-editor-form [name="id"]', "preview-layer");
    await page.fill('.layer-editor-form [name="name"]', "プレビュー用レイヤー");
    await page.fill(
      '.layer-editor-form [name="urlTemplate"]',
      "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    );
    await page.fill('.layer-editor-form [name="attribution"]', "国土地理院");
    await page.fill('.layer-editor-form [name="opacity"]', "1");
    await page.fill('.layer-editor-form [name="minZoom"]', "0");
    await page.fill('.layer-editor-form [name="maxZoom"]', "18");

    await page.locator(".layer-editor-form__preview").click();

    await expect(page.locator("#preview-map .leaflet-tile-loaded").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("プレビュー対象レイヤーが現在の表示範囲にデータを持たなくても、常に基準地図が背景に表示される", async ({
    page,
  }) => {
    await page.goto("/admin-tool/");
    await page.locator(".layer-list-view__add").click();

    // 能登半島専用タイル等、初期表示位置（東京付近）にはデータが存在しない
    // レイヤーを想定し、常に404を返すURLで模擬する。
    await page.route("https://example.com/no-coverage-here/**", (route) =>
      route.fulfill({ status: 404, body: "" }),
    );

    await page.fill('.layer-editor-form [name="id"]', "no-coverage-layer");
    await page.fill('.layer-editor-form [name="name"]', "被覆範囲外レイヤー");
    await page.fill(
      '.layer-editor-form [name="urlTemplate"]',
      "https://example.com/no-coverage-here/{z}/{x}/{y}.png",
    );
    await page.fill('.layer-editor-form [name="attribution"]', "テスト");
    await page.fill('.layer-editor-form [name="opacity"]', "1");
    await page.fill('.layer-editor-form [name="minZoom"]', "0");
    await page.fill('.layer-editor-form [name="maxZoom"]', "18");

    await page.locator(".layer-editor-form__preview").click();

    // プレビュー対象のタイルはすべて404だが、基準地図（地理院地図標準）が
    // 常に背景に表示され続けるため、地図上には読み込み済みタイルが存在し、
    // ユーザーはそれを見ながら目的地へパン・ズームできる。
    await expect(page.locator("#preview-map .leaflet-tile-loaded").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("layers.jsonをダウンロードできる", async ({ page }) => {
    await page.goto("/admin-tool/");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".admin-toolbar__export").click(),
    ]);

    expect(download.suggestedFilename()).toBe("layers.json");
  });
});
