import { describe, expect, it } from "vitest";
import { getContrastRatio } from "./colorContrast";

describe("getContrastRatio", () => {
  it("returns 21:1 for black on white (the maximum possible ratio)", () => {
    expect(getContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("returns 1:1 for identical colors", () => {
    expect(getContrastRatio("#1a5fb4", "#1a5fb4")).toBeCloseTo(1, 5);
  });

  it("is symmetric regardless of argument order", () => {
    const a = getContrastRatio("#1a5fb4", "#ffffff");
    const b = getContrastRatio("#ffffff", "#1a5fb4");
    expect(a).toBeCloseTo(b, 5);
  });

  it("accepts 3-digit shorthand hex colors", () => {
    expect(getContrastRatio("#000", "#fff")).toBeCloseTo(21, 0);
  });
});

// 屋外の強い日差し下でも視認できるよう、実際にUIで使用している主要な
// 前景色/背景色の組み合わせがWCAG AA基準（通常文字 4.5:1 以上）を
// 満たすことを固定する回帰テスト（Requirement 6.3）。
// 色の値は src/style.css の定義と一致させること。
describe("UI color pairs meet WCAG AA contrast (>= 4.5:1)", () => {
  const AA_NORMAL_TEXT = 4.5;

  it.each([
    ["layer-control__button text on white", "#111111", "#ffffff"],
    ["layer-control__button--active text on brand blue", "#ffffff", "#1a5fb4"],
    ["location-control__error text on error red", "#ffffff", "#b3261e"],
    ["poi-detail-panel link text on white", "#1a5fb4", "#ffffff"],
    ["poi-detail-panel description text on white", "#111111", "#ffffff"],
  ])("%s", (_label, foreground, background) => {
    expect(getContrastRatio(foreground, background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});
