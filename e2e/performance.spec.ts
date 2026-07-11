import { test, expect } from "@playwright/test";
import type { TourConfig } from "../src/types/config";

// 実際のsample-tour.jsonのPOI密度感を保ったまま、Requirement 7が想定する
// 「100件超」規模のPOIを機械的に生成する。
function buildLargeTour(poiCount: number): TourConfig {
  const baseLat = 35.681236;
  const baseLng = 139.767125;
  const pois = Array.from({ length: poiCount }, (_, i) => ({
    id: `perf-poi-${i}`,
    name: `テスト観察点${i}`,
    description: "パフォーマンス計測用のダミーPOI。",
    position: {
      lat: baseLat + (i % 20) * 0.0006,
      lng: baseLng + Math.floor(i / 20) * 0.0006,
    },
    media: [],
    referencePapers: [],
  }));
  return {
    id: "sample-tour",
    title: "パフォーマンス計測用ツアー",
    description: "大量POI描画のE2Eパフォーマンステスト用。",
    layerIds: ["gsi-std"],
    pois,
    routes: [],
  };
}

test.describe("大量POI描画時のパフォーマンス（Requirement 7）", () => {
  test("POI 150件でも初期表示が3秒以内に完了し、地図操作も継続できる", async ({ page }) => {
    const tour = buildLargeTour(150);
    await page.route("**/config/tours/sample-tour.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(tour),
      }),
    );

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    const start = Date.now();
    await page.goto("/");
    await expect(page.locator(".leaflet-marker-icon:not(.location-marker)")).toHaveCount(150, {
      timeout: 5000,
    });
    const elapsed = Date.now() - start;

    // Requirement 7.1: 初期表示（現在地周辺）が3秒以内に完了すること。
    expect(elapsed).toBeLessThan(3000);

    // 描画後も地図操作（ズーム）が固まらず反応し続けることを確認する。
    await page.locator(".leaflet-control-zoom-in").click();
    await expect(page.locator(".leaflet-marker-icon:not(.location-marker)")).toHaveCount(150);

    expect(pageErrors).toEqual([]);
  });
});
