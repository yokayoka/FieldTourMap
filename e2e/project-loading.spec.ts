import { test, expect } from "@playwright/test";
import { layersToSheet, mergeTourIntoSheets } from "../src/services/googleSheetsRowMapping";
import type { LayerDefinition, TourConfig } from "../src/types/config";

const PROJECT_ID = "third-party-project-sheet-id";

const projectLayers: LayerDefinition[] = [
  {
    id: "third-party-base",
    name: "第三者提供のベースマップ",
    type: "base",
    urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "third-party",
    opacity: 1,
    minZoom: 2,
    maxZoom: 19,
    defaultVisible: true,
  },
];

const projectTour: TourConfig = {
  id: "third-party-tour",
  title: "第三者の巡検コース",
  description: "GitHubを使わない主催者が作成したプロジェクトのサンプル。",
  layerIds: ["third-party-base"],
  pois: [
    {
      id: "poi-external-01",
      name: "第三者POI",
      description: "第三者が作成した観察地点。",
      // 既定の初期表示位置（DEFAULT_CENTER、東京付近）から意図的に遠く離れた
      // 座標にする。`?project=`読み込み時は初期表示でもこのPOI範囲へ
      // 自動的に再センタリングされる（centerOnPois）ため、ここでマーカーを
      // クリックできることが、その再センタリングが実際に効いていることの
      // 検証になる。
      position: { lat: 37.4, lng: 136.9 },
      media: [],
      referencePapers: [],
    },
  ],
  routes: [],
};

/** シート行(string[][])をGoogleの公開CSVエンドポイント相当のCSVテキストへ変換する。 */
function rowsToCsvText(rows: string[][]): string {
  return rows
    .map((row) =>
      row.map((cell) => (/[,"\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","),
    )
    .join("\n");
}

/** `project`パラメータで読み込む公開スプレッドシートの内容をルートインターセプトで模擬する。 */
async function mockPublicProjectSheets(
  page: import("@playwright/test").Page,
  sheetsBySheetName: Record<string, string[][]>,
): Promise<void> {
  await page.route(
    (url) => url.hostname === "docs.google.com" && url.pathname.includes("/spreadsheets/"),
    (route) => {
      const url = new URL(route.request().url());
      const sheetName = url.searchParams.get("sheet") ?? "";
      const rows = sheetsBySheetName[sheetName];
      // 実際のGoogle公開CSVエンドポイントはクロスオリジンfetchを許可する
      // CORSヘッダーを返すため、モックでも同様に付与する（付与しないと
      // ブラウザがCORSでレスポンスを拒否し、ネットワークエラー扱いになる）。
      const corsHeaders = { "Access-Control-Allow-Origin": "*" };
      if (!rows) {
        return route.fulfill({
          status: 404,
          contentType: "text/plain",
          headers: corsHeaders,
          body: "not found",
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "text/csv",
        headers: corsHeaders,
        body: rowsToCsvText(rows),
      });
    },
  );
}

test.describe("第三者プロジェクトの読み込み（Requirement 16）", () => {
  test("?project=<spreadsheetId>で、認証なしに公開CSV経由のプロジェクトが表示される", async ({
    page,
  }) => {
    const merged = mergeTourIntoSheets({}, projectTour);
    await mockPublicProjectSheets(page, {
      Layers: layersToSheet(projectLayers),
      Tours: merged.Tours ?? [],
      POIs: merged.POIs ?? [],
      Media: merged.Media ?? [],
      ReferencePapers: merged.ReferencePapers ?? [],
      Routes: merged.Routes ?? [],
      RoutePoints: merged.RoutePoints ?? [],
    });

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto(`/?project=${PROJECT_ID}`);

    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".tour-selector-control__button")).toHaveText("第三者の巡検コース");
    await expect(page.getByRole("radio", { name: "第三者提供のベースマップ" })).toBeVisible();

    const marker = page.locator(".leaflet-marker-icon:not(.location-marker)").first();
    await marker.click();
    await expect(page.locator(".poi-detail-panel__title")).toHaveText("第三者POI");

    expect(pageErrors).toEqual([]);
  });

  test("project未指定時は従来通り既定の静的設定（サンプル巡検コース）が表示される", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator(".tour-selector-control__button")).toHaveText("サンプル巡検コース");
  });

  test("スプレッドシートが未公開/読み込み失敗の場合、エラーメッセージを表示しクラッシュしない", async ({
    page,
  }) => {
    await page.route("https://docs.google.com/spreadsheets/**", (route) =>
      route.fulfill({ status: 404, contentType: "text/plain", body: "not found" }),
    );

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto(`/?project=${PROJECT_ID}`);

    const banner = page.locator(".app-error-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("プロジェクトの読み込みに失敗しました");
    expect(pageErrors).toEqual([]);
  });

  test("プロジェクトごとにレイヤー選択状態が独立して永続化される（Requirement 16.9）", async ({
    page,
  }) => {
    const merged = mergeTourIntoSheets({}, projectTour);
    await mockPublicProjectSheets(page, {
      Layers: layersToSheet(projectLayers),
      Tours: merged.Tours ?? [],
      POIs: merged.POIs ?? [],
      Media: merged.Media ?? [],
      ReferencePapers: merged.ReferencePapers ?? [],
      Routes: merged.Routes ?? [],
      RoutePoints: merged.RoutePoints ?? [],
    });

    await page.goto(`/?project=${PROJECT_ID}`);
    await expect(page.locator(".leaflet-container")).toBeVisible();

    // レイヤー状態はsetBaseLayer/toggleOverlay等、明示的な変更操作の際に
    // 初めて永続化される（ページ読み込みだけでは書き込まれない）ため、
    // ボタン操作を行ってから確認する。
    await page.getByRole("radio", { name: "第三者提供のベースマップ" }).click();

    const defaultKeyValue = await page.evaluate(() =>
      localStorage.getItem("fieldtour.layerState.v1"),
    );
    const projectKeyValue = await page.evaluate(
      (projectId) => localStorage.getItem(`fieldtour.layerState.v1.project.${projectId}`),
      PROJECT_ID,
    );

    expect(defaultKeyValue).toBeNull();
    expect(projectKeyValue).not.toBeNull();
  });

  test("共有URLにprojectパラメータが含まれ、受信側で同じプロジェクトが再現される", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const merged = mergeTourIntoSheets({}, projectTour);
    await mockPublicProjectSheets(page, {
      Layers: layersToSheet(projectLayers),
      Tours: merged.Tours ?? [],
      POIs: merged.POIs ?? [],
      Media: merged.Media ?? [],
      ReferencePapers: merged.ReferencePapers ?? [],
      Routes: merged.Routes ?? [],
      RoutePoints: merged.RoutePoints ?? [],
    });

    await page.goto(`/?project=${PROJECT_ID}`);
    await expect(page.locator(".leaflet-container")).toBeVisible();

    await page.locator(".share-control__button").click();
    const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(sharedUrl).toContain(`project=${PROJECT_ID}`);

    const otherContext = await page.context().browser()!.newContext();
    const otherPage = await otherContext.newPage();
    await mockPublicProjectSheets(otherPage, {
      Layers: layersToSheet(projectLayers),
      Tours: merged.Tours ?? [],
      POIs: merged.POIs ?? [],
      Media: merged.Media ?? [],
      ReferencePapers: merged.ReferencePapers ?? [],
      Routes: merged.Routes ?? [],
      RoutePoints: merged.RoutePoints ?? [],
    });
    await otherPage.goto(sharedUrl);
    await expect(otherPage.locator(".tour-selector-control__button")).toHaveText(
      "第三者の巡検コース",
    );
    await otherContext.close();
  });
});
