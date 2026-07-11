/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// GitHub Pagesはリポジトリ名のサブパス配下に配信されるため、
// 本番ビルド時のみ base をリポジトリ名に切り替える（Requirement 12.4）。
const repoName = "FieldTourMap";

export default defineConfig(({ command }) => ({
  base: command === "build" ? `/${repoName}/` : "/",
  build: {
    // 参加者向けMap Viewer（index.html）と主催者向けAdmin Config Tool
    // （admin-tool/index.html, admin-tool/tour-editor.html）を
    // マルチページ構成でビルドする。
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        adminTool: fileURLToPath(new URL("./admin-tool/index.html", import.meta.url)),
        adminTourEditor: fileURLToPath(
          new URL("./admin-tool/tour-editor.html", import.meta.url),
        ),
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "admin-tool/src/**/*.test.ts"],
  },
}));
