import { test, expect, type Page, type Route } from "@playwright/test";

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
  // 実際のGISスクリプト読み込み自体は空レスポンスで完了させ、上記スタブを温存する。
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
}

/** Sheets API v4のvalues.get/values.updateをメモリ上のシート状態でスタブする。 */
function mockSheetsApi(page: Page): { getPutBody: (range: string) => unknown } {
  const store = new Map<string, string[][]>();
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

test.describe("Admin Config Tool: レイヤー編集のGoogleスプレッドシート連携（Requirement 15）", () => {
  test("ログイン前は保存/読み込みボタンが無効化されている", async ({ page }) => {
    await page.goto("/admin-tool/");

    await expect(page.locator(".google-sheets-panel__save")).toBeDisabled();
    await expect(page.locator(".google-sheets-panel__load")).toBeDisabled();
  });

  test("ログインすると保存/読み込みボタンが有効になり、スプレッドシートへ保存できる", async ({
    page,
  }) => {
    await mockGoogleLogin(page);
    const sheetsApi = mockSheetsApi(page);

    await page.goto("/admin-tool/");
    await page.fill(".google-sheets-panel__client-id", "test-client-id");
    await page.fill(".google-sheets-panel__spreadsheet-id", "test-sheet-id");

    await page.locator(".google-sheets-panel__authorize").click();
    await expect(page.locator(".google-sheets-panel__status")).toContainText("認可されました");
    await expect(page.locator(".google-sheets-panel__save")).toBeEnabled();

    await page.locator(".google-sheets-panel__save").click();
    await expect(page.locator(".google-sheets-panel__status")).toContainText("保存しました");

    const putBody = sheetsApi.getPutBody("Layers") as { values: string[][] };
    expect(putBody.values[0]).toEqual([
      "id",
      "name",
      "type",
      "urlTemplate",
      "attribution",
      "opacity",
      "minZoom",
      "maxZoom",
      "defaultVisible",
    ]);
    // 公開中のlayers.json（4件）がそのまま書き込まれること。
    expect(putBody.values).toHaveLength(5);
  });

  test("スプレッドシートから読み込むと一覧が置き換わる", async ({ page }) => {
    await mockGoogleLogin(page);
    mockSheetsApi(page);

    await page.goto("/admin-tool/");
    await page.fill(".google-sheets-panel__client-id", "test-client-id");
    await page.fill(".google-sheets-panel__spreadsheet-id", "test-sheet-id");
    await page.locator(".google-sheets-panel__authorize").click();
    await expect(page.locator(".google-sheets-panel__save")).toBeEnabled();

    // 事前にスプレッドシート側へ保存してから読み込む（往復確認）。
    await page.locator(".google-sheets-panel__save").click();
    await expect(page.locator(".google-sheets-panel__status")).toContainText("保存しました");

    // ローカルの一覧を変更してから読み込み、スプレッドシート側の内容で
    // 置き換わることを確認する。
    await page
      .locator(".layer-list-view__item")
      .first()
      .locator(".layer-list-view__delete")
      .click();
    await expect(page.locator(".layer-list-view__item")).toHaveCount(3);

    await page.locator(".google-sheets-panel__load").click();
    await expect(page.locator(".google-sheets-panel__status")).toContainText("読み込みました");
    await expect(page.locator(".layer-list-view__item")).toHaveCount(4);
  });

  test("スプレッドシートIDが未入力の場合はエラーを表示し、既存のJSONダウンロード機能には影響しない", async ({
    page,
  }) => {
    await mockGoogleLogin(page);
    mockSheetsApi(page);

    await page.goto("/admin-tool/");
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
    expect(download.suggestedFilename()).toBe("layers.json");
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

    await page.goto("/admin-tool/");
    await page.fill(".google-sheets-panel__client-id", "test-client-id");
    await page.locator(".google-sheets-panel__authorize").click();

    await expect(page.locator(".google-sheets-panel__status")).toContainText("認可に失敗しました");
    await expect(page.locator(".google-sheets-panel__save")).toBeDisabled();
  });
});
