import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      // スマートフォン実利用を想定し、モバイル端末プロファイル（タッチ操作・
      // モバイルビューポート）をデフォルトで用いる（Requirement 6）。
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
