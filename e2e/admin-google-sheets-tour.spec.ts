import { test, expect, type Page, type Route } from "@playwright/test";
import { mergeTourIntoSheets, type SheetsData } from "../src/services/googleSheetsRowMapping";
import type { TourConfig } from "../src/types/config";

/** Google Identity Services（GIS）をスタブし、常に成功するOAuthログインを模擬する。 */
async function mockGoogleLogin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: (config: { callback: (response: { access_token: string }) => void }) => ({
            requestAccessToken: () => config.callback({ access_token: "fake-access-token" }),
          }),
        },
      },
    };
  });
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
}

/**
 * Sheets API v4のvalues.get/values.updateをメモリ上のシート状態でスタブする。
 * seedを渡すと、Tours/POIs等の初期データとしてGETに返す（複数ツアーを
 * 含むスプレッドシートを模擬する用途）。
 */
function mockSheetsApi(page: Page, seed: SheetsData = {}): { getPutBody: (range: string) => unknown } {
  const store = new Map<string, string[][]>();
  (Object.keys(seed) as (keyof SheetsData)[]).forEach((name) => {
    const rows = seed[name];
    if (rows) store.set(name, rows);
  });
  const putBodies = new Map<string, unknown>();

  page.route(
    (url) => url.hostname === "sheets.googleapis.com" && url.pathname.includes("/values/"),
    async (route: Route) => {
      const request = route.request();
      const url = new URL(request.url());
      const match = /\/spreadsheets\/[^/]+\/values\/([^/?]+)/.exec(url.pathname);
      const range = match ? decodeURIComponent(match[1]) : "";

      if (request.method() === "GET") {
        const values = store.get(range);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ values: values ?? [] }),
        });
      }
      if (request.method() === "PUT") {
        const body = request.postDataJSON() as { values: string[][] };
        store.set(range, body.values);
        putBodies.set(range, body);
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
      return route.continue();
    },
  );

  return { getPutBody: (range: string) => putBodies.get(range) };
}

const TOUR_ALPHA: TourConfig = {
  id: "tour-alpha",
  title: "アルファ巡検コース",
  description: "テスト用のツアーA",
  layerIds: ["osm"],
  pois: [
    {
      id: "poi-alpha-1",
      name: "アルファ地点1",
      description: "アルファ用の説明",
      position: { lat: 35.0, lng: 139.0 },
      media: [],
      referencePapers: [],
    },
  ],
  routes: [],
};

const TOUR_BETA: TourConfig = {
  id: "tour-beta",
  title: "ベータ巡検コース",
  description: "テスト用のツアーB",
  layerIds: ["osm"],
  pois: [
    {
      id: "poi-beta-1",
      name: "ベータ地点1",
      description: "ベータ用の説明",
      position: { lat: 36.0, lng: 140.0 },
      media: [],
      referencePapers: [],
    },
    {
      id: "poi-beta-2",
      name: "ベータ地点2",
      description: "ベータ用の説明2",
      position: { lat: 36.1, lng: 140.1 },
      media: [],
      referencePapers: [],
    },
  ],
  routes: [],
};

function seedTwoTours(): SheetsData {
  let sheets: SheetsData = {};
  sheets = mergeTourIntoSheets(sheets, TOUR_ALPHA);
  sheets = mergeTourIntoSheets(sheets, TOUR_BETA);
  return sheets;
}

test.describe("Admin Config Tool: ツアー編集のGoogleスプレッドシート連携（Requirement 15）", () => {
  test("ログイン前は保存/読み込みボタンが無効化されている", async ({ page }) => {
    await page.goto("/admin-tool/tour-editor.html");
    await page.waitForTimeout(500);

    await expect(page.locator(".google-sheets-panel__save")).toBeDisabled();
    await expect(page.locator(".google-sheets-panel__load")).toBeDisabled();
  });

  test("現在編集中のツアーを保存すると、複数シートに分けて書き込まれる", async ({ page }) => {
    await mockGoogleLogin(page);
    const sheetsApi = mockSheetsApi(page);

    await page.goto("/admin-tool/tour-editor.html");
    await page.waitForTimeout(500);
    await page.fill(".google-sheets-panel__client-id", "test-client-id");
    await page.fill(".google-sheets-panel__spreadsheet-id", "test-sheet-id");
    await page.locator(".google-sheets-panel__authorize").click();
    await expect(page.locator(".google-sheets-panel__save")).toBeEnabled();

    // 初期状態で読み込まれる公開中のsample-tourをそのまま保存する。
    await page.locator(".google-sheets-panel__save").click();
    await expect(page.locator(".google-sheets-panel__status")).toContainText("保存しました");

    const toursPut = sheetsApi.getPutBody("Tours") as { values: string[][] };
    expect(toursPut.values[0]).toEqual(["tourId", "title", "description", "layerIds"]);
    expect(toursPut.values.some((row) => row[0] === "sample-tour")).toBe(true);

    const poisPut = sheetsApi.getPutBody("POIs") as { values: string[][] };
    expect(poisPut.values[0]).toEqual(["tourId", "poiId", "name", "description", "lat", "lng"]);
  });

  test("複数ツアーを含むスプレッドシートから、対象ツアーIDのもののみを読み込める", async ({
    page,
  }) => {
    await mockGoogleLogin(page);
    mockSheetsApi(page, seedTwoTours());

    await page.goto("/admin-tool/tour-editor.html");
    await page.waitForTimeout(500);
    await page.fill(".google-sheets-panel__client-id", "test-client-id");
    await page.fill(".google-sheets-panel__spreadsheet-id", "test-sheet-id");
    await page.locator(".google-sheets-panel__authorize").click();
    await expect(page.locator(".google-sheets-panel__load")).toBeEnabled();

    await page.fill('[name="tour-id"]', "tour-beta");
    await page.locator(".google-sheets-panel__load").click();

    await expect(page.locator(".google-sheets-panel__status")).toContainText("読み込みました");
    await expect(page.locator('[name="tour-title"]')).toHaveValue(TOUR_BETA.title);

    const poiSection = page.locator("section:has(h2:text('見学ポイント'))");
    await expect(poiSection.locator(".simple-list-view__item")).toHaveCount(TOUR_BETA.pois.length);
    await expect(poiSection).toContainText("ベータ地点1");
    await expect(poiSection).toContainText("ベータ地点2");
    // tour-alpha側のPOIは含まれないこと。
    await expect(poiSection).not.toContainText("アルファ地点1");
  });

  test("スプレッドシートに存在しないツアーIDを指定するとエラーになる", async ({ page }) => {
    await mockGoogleLogin(page);
    mockSheetsApi(page, seedTwoTours());

    await page.goto("/admin-tool/tour-editor.html");
    await page.waitForTimeout(500);
    await page.fill(".google-sheets-panel__client-id", "test-client-id");
    await page.fill(".google-sheets-panel__spreadsheet-id", "test-sheet-id");
    await page.locator(".google-sheets-panel__authorize").click();
    await expect(page.locator(".google-sheets-panel__load")).toBeEnabled();

    await page.fill('[name="tour-id"]', "tour-nonexistent");
    await page.locator(".google-sheets-panel__load").click();

    await expect(page.locator(".google-sheets-panel__status")).toContainText(
      "tour-nonexistent",
    );
  });

  test("スプレッドシートIDが未入力の場合はエラーを表示し、既存のJSONダウンロード機能には影響しない", async ({
    page,
  }) => {
    await mockGoogleLogin(page);
    mockSheetsApi(page);

    await page.goto("/admin-tool/tour-editor.html");
    await page.waitForTimeout(500);
    await page.fill(".google-sheets-panel__client-id", "test-client-id");
    await page.locator(".google-sheets-panel__authorize").click();
    await expect(page.locator(".google-sheets-panel__save")).toBeEnabled();

    await page.locator(".google-sheets-panel__save").click();
    await expect(page.locator(".google-sheets-panel__status")).toContainText(
      "スプレッドシートIDを入力してください",
    );

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".admin-toolbar__export").click(),
    ]);
    expect(download.suggestedFilename()).toBe("sample-tour.json");
  });

  test("認可に失敗した場合、保存/読み込みボタンは無効のままエラーメッセージを表示する", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { google: unknown }).google = {
        accounts: {
          oauth2: {
            initTokenClient: (config: { callback: (response: object) => void }) => ({
              requestAccessToken: () => config.callback({}),
            }),
          },
        },
      };
    });
    await page.route("https://accounts.google.com/gsi/client", (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
    );

    await page.goto("/admin-tool/tour-editor.html");
    await page.waitForTimeout(500);
    await page.fill(".google-sheets-panel__client-id", "test-client-id");
    await page.locator(".google-sheets-panel__authorize").click();

    await expect(page.locator(".google-sheets-panel__status")).toContainText("認可に失敗しました");
    await expect(page.locator(".google-sheets-panel__save")).toBeDisabled();
  });
});
