import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a simple comma-separated grid", () => {
    const csv = "id,name\ngsi-std,地理院地図\naist-geology,シームレス地質図";
    expect(parseCsv(csv)).toEqual([
      ["id", "name"],
      ["gsi-std", "地理院地図"],
      ["aist-geology", "シームレス地質図"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("handles CRLF line endings", () => {
    const csv = "a,b\r\n1,2\r\n3,4";
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("parses a quoted field containing a comma", () => {
    const csv = 'id,citation\npoi-01,"山田,太郎 (2020)"';
    expect(parseCsv(csv)).toEqual([
      ["id", "citation"],
      ["poi-01", "山田,太郎 (2020)"],
    ]);
  });

  it("parses a quoted field containing an embedded newline", () => {
    const csv = 'id,description\npoi-01,"line1\nline2"';
    expect(parseCsv(csv)).toEqual([
      ["id", "description"],
      ["poi-01", "line1\nline2"],
    ]);
  });

  it("unescapes doubled double-quotes inside a quoted field", () => {
    const csv = 'id,text\npoi-01,"カンマ,と""引用符""と改行"';
    expect(parseCsv(csv)).toEqual([
      ["id", "text"],
      ["poi-01", 'カンマ,と"引用符"と改行'],
    ]);
  });

  it("treats a trailing newline as end-of-file, not an extra empty row", () => {
    const csv = "a,b\n1,2\n";
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("preserves empty fields", () => {
    const csv = "a,b,c\n1,,3";
    expect(parseCsv(csv)).toEqual([
      ["a", "b", "c"],
      ["1", "", "3"],
    ]);
  });

  it("parses a field that is entirely a quoted empty string", () => {
    const csv = 'a,b\n"",2';
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["", "2"],
    ]);
  });
});
