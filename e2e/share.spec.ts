import { test, expect } from "@playwright/test";

test.describe("URL共有機能（Requirement 13）", () => {
  test("現在のビュー状態を共有URLとしてコピーし、別セッションで再現できる", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    // レイヤー状態を変更してから共有する。
    await page.getByRole("radio", { name: "OpenStreetMap" }).click();
    await page.locator(".layer-control__checkbox").check();

    await page.locator(".share-control__button").click();
    await expect(page.locator(".share-control__feedback")).toBeVisible();

    const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(sharedUrl).toContain("base=osm");
    expect(sharedUrl).toContain("overlay=aist-geology");
    expect(sharedUrl).toMatch(/lat=-?\d+\.\d+/);
    expect(sharedUrl).toMatch(/zoom=\d+/);

    // 別セッション（別コンテキスト）で共有URLを開き、状態が復元されることを確認する。
    const otherContext = await page.context().browser()!.newContext();
    const otherPage = await otherContext.newPage();
    await otherPage.goto(sharedUrl);
    await expect(otherPage.locator(".leaflet-container")).toBeVisible();
    await expect(otherPage.getByRole("radio", { name: "OpenStreetMap" })).toHaveClass(
      /layer-control__button--active/,
    );
    await expect(otherPage.locator(".layer-control__checkbox")).toBeChecked();
    await otherContext.close();
  });

  test("POI詳細を開いた状態で共有すると、受信側でも同じPOIパネルが自動的に開く", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/");
    await page.locator(".leaflet-marker-icon:not(.location-marker)").first().click();
    await expect(page.locator(".poi-detail-panel")).toBeVisible();
    const title = await page.locator(".poi-detail-panel__title").textContent();

    await page.locator(".share-control__button").click();
    const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(sharedUrl).toContain("poi=poi-01");

    const otherContext = await page.context().browser()!.newContext();
    const otherPage = await otherContext.newPage();
    await otherPage.goto(sharedUrl);
    await expect(otherPage.locator(".poi-detail-panel")).toBeVisible();
    await expect(otherPage.locator(".poi-detail-panel__title")).toHaveText(title ?? "");
    await otherContext.close();
  });

  test("クリップボードAPIが使えない場合は手動コピー用のフォールバックUIが表示される", async ({
    page,
  }) => {
    // Web Share APIはテスト用ブラウザでは既定で未対応（navigator.share
    // 自体が存在しない）ため、クリップボードAPIも使えなくすることで
    // 両方の共有手段が失敗するケースを再現する（iOS Safari等で発生しうる）。
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
    });

    await page.goto("/");
    await page.locator(".share-control__button").click();

    const panel = page.locator(".link-fallback-panel");
    await expect(panel).toBeVisible();
    const input = panel.locator(".link-fallback-panel__input");
    await expect(input).toHaveValue(/^http:\/\/localhost:4173\/\?/);

    await panel.locator(".link-fallback-panel__close").click();
    await expect(panel).toBeHidden();
  });

  test("不正な共有URLの場合はエラーにならず初期表示にフォールバックする（Requirement 13.7）", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto("/?lat=not-a-number&lng=139.7&zoom=15&base=gsi-std");

    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".app-error-banner")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });
});
