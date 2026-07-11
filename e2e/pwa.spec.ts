import { test, expect } from "@playwright/test";

test.describe("PWA対応（Requirement 6, 7）", () => {
  test("manifest.jsonがリンクされ、ホーム画面インストールに必要な情報を含む", async ({
    page,
  }) => {
    await page.goto("/");

    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveCount(1);
    const manifestHref = await manifestLink.getAttribute("href");
    expect(manifestHref).toBeTruthy();

    const manifestUrl = new URL(manifestHref!, page.url()).toString();
    const response = await page.request.get(manifestUrl);
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBeTruthy();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    // 少なくとも1件はmaskable purposeを持つこと（Android端末での適応アイコン対応）。
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(
      true,
    );

    // マニフェストが参照するアイコンが実際に取得できることを確認する。
    for (const icon of manifest.icons) {
      const iconUrl = new URL(icon.src, manifestUrl).toString();
      const iconResponse = await page.request.get(iconUrl);
      expect(iconResponse.ok()).toBe(true);
    }
  });

  test("iOSホーム画面インストール用のメタタグ・apple-touch-iconが設定されている", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
      "content",
      "yes",
    );
    const appleIconLink = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleIconLink).toHaveCount(1);
    const appleIconHref = await appleIconLink.getAttribute("href");
    const appleIconUrl = new URL(appleIconHref!, page.url()).toString();
    const response = await page.request.get(appleIconUrl);
    expect(response.ok()).toBe(true);
  });
});
