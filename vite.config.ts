/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// GitHub Pagesはリポジトリ名のサブパス配下に配信されるため、
// 本番ビルド時のみ base をリポジトリ名に切り替える（Requirement 12.4）。
const repoName = "field_tour";

export default defineConfig(({ command }) => ({
  base: command === "build" ? `/${repoName}/` : "/",
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
}));
