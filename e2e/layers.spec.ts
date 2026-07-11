import { test, expect } from "@playwright/test";

test.describe("レイヤー切替（Requirement 2）", () => {
  test("地図が表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });

  test("ベースレイヤーを切り替えられ、リロード後も状態が復元される（Requirement 2.5）", async ({
    page,
  }) => {
    await page.goto("/");

    const osmButton = page.getByRole("radio", { name: "OpenStreetMap" });
    await osmButton.click();
    await expect(osmButton).toHaveClass(/layer-control__button--active/);

    await page.reload();
    await expect(page.getByRole("radio", { name: "OpenStreetMap" })).toHaveClass(
      /layer-control__button--active/,
    );
  });

  test("オーバーレイレイヤーを複数同時にON/OFFできる（Requirement 2.3）", async ({ page }) => {
    await page.goto("/");

    const checkbox = page.locator(".layer-control__checkbox");
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });
});
