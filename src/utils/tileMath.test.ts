import { describe, expect, it } from "vitest";
import { buildTileUrl, getTileCoordsForBounds, lngLatToTile } from "./tileMath";

describe("lngLatToTile", () => {
  it("maps the whole world to a single tile at zoom 0", () => {
    expect(lngLatToTile(0, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(lngLatToTile(139.7671, 35.6812, 0)).toEqual({ x: 0, y: 0 });
  });

  it("maps the west edge of the map to column 0 at any zoom", () => {
    expect(lngLatToTile(-180, 0, 5)).toEqual(expect.objectContaining({ x: 0 }));
  });

  it("maps a point just short of the east edge to the last column", () => {
    const zoom = 4;
    const n = 2 ** zoom;
    expect(lngLatToTile(179.9, 0, zoom)).toEqual(expect.objectContaining({ x: n - 1 }));
  });

  it("increases x monotonically as longitude increases", () => {
    const zoom = 6;
    const west = lngLatToTile(-100, 20, zoom).x;
    const east = lngLatToTile(100, 20, zoom).x;
    expect(east).toBeGreaterThan(west);
  });

  it("keeps tile indices within [0, 2^zoom) for valid coordinates", () => {
    const zoom = 8;
    const n = 2 ** zoom;
    const { x, y } = lngLatToTile(139.7671, 35.6812, zoom);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(n);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThan(n);
  });
});

describe("getTileCoordsForBounds", () => {
  it("returns exactly one tile at zoom 0 regardless of the bounds", () => {
    const coords = getTileCoordsForBounds(
      { north: 45, south: -45, east: 170, west: -170 },
      0,
    );
    expect(coords).toEqual([{ z: 0, x: 0, y: 0 }]);
  });

  it("returns exactly one tile for a degenerate (single-point) bounding box", () => {
    const coords = getTileCoordsForBounds(
      { north: 35.6812, south: 35.6812, east: 139.7671, west: 139.7671 },
      12,
    );
    expect(coords).toHaveLength(1);
  });

  it("roughly quadruples the tile count when zoom increases by one", () => {
    const bounds = { north: 35.7, south: 35.6, east: 139.8, west: 139.7 };
    const atZoom10 = getTileCoordsForBounds(bounds, 10).length;
    const atZoom11 = getTileCoordsForBounds(bounds, 11).length;
    expect(atZoom11).toBeGreaterThanOrEqual(atZoom10 * 2);
  });

  it("produces coordinates all tagged with the requested zoom level", () => {
    const coords = getTileCoordsForBounds(
      { north: 35.7, south: 35.6, east: 139.8, west: 139.7 },
      10,
    );
    expect(coords.every((c) => c.z === 10)).toBe(true);
  });
});

describe("buildTileUrl", () => {
  it("substitutes z/x/y placeholders", () => {
    expect(buildTileUrl("https://example.com/{z}/{x}/{y}.png", { z: 5, x: 10, y: 20 })).toBe(
      "https://example.com/5/10/20.png",
    );
  });

  it("substitutes placeholders regardless of their order in the template", () => {
    expect(buildTileUrl("https://example.com/{z}/{y}/{x}.png", { z: 5, x: 10, y: 20 })).toBe(
      "https://example.com/5/20/10.png",
    );
  });
});
