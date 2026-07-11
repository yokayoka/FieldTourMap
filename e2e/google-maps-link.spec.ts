import { test, expect } from "@playwright/test";

test.describe("Googleマップリンク取得機能（Requirement 14）", () => {
  test("地図タップでピン留め形式のGoogleマップリンクをコピーし、トーストが表示される", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto("/");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    await page.locator(".google-maps-link-control__toggle").click();
    await expect(page.locator(".google-maps-link-control__toggle")).toHaveClass(
      /google-maps-link-control__toggle--active/,
    );

    await page.locator("#map").click({ position: { x: 195, y: 150 } });

    await expect(page.locator(".google-maps-link-control__toggle")).not.toHaveClass(
      /google-maps-link-control__toggle--active/,
    );
    await expect(page.locator(".toast")).toBeVisible();
    await expect(page.locator(".toast")).toContainText("コピーしました");

    const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiedUrl).toMatch(
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=-?\d+\.\d+,-?\d+\.\d+$/,
    );

    expect(pageErrors).toEqual([]);
  });

  test("POI詳細パネルからGoogleマップリンクを取得できる", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/");
    await page.locator(".leaflet-marker-icon:not(.location-marker)").first().click();
    await expect(page.locator(".poi-detail-panel")).toBeVisible();

    await page.locator(".poi-detail-panel__google-maps-link").click();
    await expect(page.locator(".toast")).toBeVisible();

    const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiedUrl).toBe(
      "https://www.google.com/maps/search/?api=1&query=35.681236,139.767125",
    );
  });

  test("クリップボードAPIが使えない場合は手動コピー用のフォールバックUIが表示される", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
    });

    await page.goto("/");
    await page.locator(".google-maps-link-control__toggle").click();
    await page.locator("#map").click({ position: { x: 195, y: 150 } });

    const panel = page.locator(".link-fallback-panel");
    await expect(panel).toBeVisible();
    const input = panel.locator(".link-fallback-panel__input");
    await expect(input).toHaveValue(/^https:\/\/www\.google\.com\/maps\/search/);

    await panel.locator(".link-fallback-panel__close").click();
    await expect(panel).toBeHidden();
  });
});
