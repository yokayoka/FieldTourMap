import { test, expect } from "@playwright/test";

test.describe("観察メモ機能（Requirement 5）", () => {
  test("地図タップでメモを追加・閲覧・編集・削除できる", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto("/");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    // メモ追加モードを有効化し、地図をタップして作成フォームを開く。
    const toggle = page.locator(".memo-control__toggle");
    await toggle.click();
    await expect(toggle).toHaveClass(/memo-control__toggle--active/);

    await page.locator("#map").click({ position: { x: 100, y: 300 } });
    await expect(toggle).not.toHaveClass(/memo-control__toggle--active/);

    const panel = page.locator(".memo-panel");
    await expect(panel).toBeVisible();
    const textarea = panel.locator(".memo-panel__textarea");
    await textarea.fill("露頭のスケッチメモ");
    await panel.locator(".memo-panel__save").click();
    await expect(panel).toBeHidden();

    // 追加したメモのピンが表示され、タップすると内容が確認できる。
    const memoMarker = page.locator(".memo-marker").first();
    await expect(memoMarker).toBeAttached();
    await memoMarker.click();
    await expect(panel).toBeVisible();
    await expect(panel.locator(".memo-panel__text")).toHaveText("露頭のスケッチメモ");

    // 編集
    await panel.locator(".memo-panel__edit").click();
    const editTextarea = panel.locator(".memo-panel__textarea");
    await editTextarea.fill("編集後のメモ");
    await panel.locator(".memo-panel__save").click();
    await expect(panel).toBeHidden();

    await memoMarker.click();
    await expect(panel.locator(".memo-panel__text")).toHaveText("編集後のメモ");

    // 削除
    await panel.locator(".memo-panel__delete").click();
    await expect(panel).toBeHidden();
    await expect(page.locator(".memo-marker")).toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });

  test("メモを追加すると再読み込み後も保持される（Requirement 5.3）", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    await page.locator(".memo-control__toggle").click();
    await page.locator("#map").click({ position: { x: 100, y: 300 } });
    await page.locator(".memo-panel__textarea").fill("永続化テスト用メモ");
    await page.locator(".memo-panel__save").click();
    await expect(page.locator(".memo-panel")).toBeHidden();

    await page.reload();
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".memo-marker")).toHaveCount(1);
  });

  test("メモをCSV/GeoJSONとしてエクスポートできる（Requirement 5.4）", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    await page.locator(".memo-control__toggle").click();
    await page.locator("#map").click({ position: { x: 100, y: 300 } });
    await page.locator(".memo-panel__textarea").fill("エクスポート確認用メモ");
    await page.locator(".memo-panel__save").click();
    await expect(page.locator(".memo-panel")).toBeHidden();

    const [csvDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".memo-control__export-csv").click(),
    ]);
    expect(csvDownload.suggestedFilename()).toBe("observation-memos.csv");

    const [geoJsonDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".memo-control__export-geojson").click(),
    ]);
    expect(geoJsonDownload.suggestedFilename()).toBe("observation-memos.geojson");
  });
});

test.describe("観察メモ機能: 配置モード中のGPS追従抑制（Requirement 5, 1.5）", () => {
  test.use({
    permissions: ["geolocation"],
    geolocation: { latitude: 35.6895, longitude: 139.6917, accuracy: 15 },
  });

  test("メモ配置モード中にGPS位置が更新されても、追従モードによる地図の再センタリングは行われない", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await expect(page.locator(".location-marker")).toBeVisible();
    // 追従モードは既定でON（e2e/geolocation.spec.tsで確認済み）。
    await expect(page.locator(".location-control__button")).toHaveClass(
      /location-control__button--active/,
    );

    const poiMarker = page.locator(".leaflet-marker-icon:not(.location-marker)").first();
    await expect(poiMarker).toBeVisible();
    const beforeBox = await poiMarker.boundingBox();
    expect(beforeBox).not.toBeNull();

    await page.locator(".memo-control__toggle").click();

    // メモ配置モード中に、大きく離れた新しいGPS位置（札幌付近）を通知する。
    // 追従モードが働いていれば地図がそこへ再センタリングされ、他のマーカー
    // の画面上の位置も大きくずれるはずである。
    await context.setGeolocation({ latitude: 43.0, longitude: 141.3, accuracy: 15 });
    await page.waitForTimeout(300);

    const afterBox = await poiMarker.boundingBox();
    expect(afterBox).not.toBeNull();
    expect(Math.abs(afterBox!.x - beforeBox!.x)).toBeLessThan(2);
    expect(Math.abs(afterBox!.y - beforeBox!.y)).toBeLessThan(2);
  });
});
