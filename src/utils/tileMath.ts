export interface TileBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

/**
 * 標準的なWeb Mercatorスリッピーマップのタイル座標系に基づき、
 * 緯度経度をXYZタイル座標に変換する。
 * https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
 */
export function lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

/**
 * 指定した範囲・ズームレベルを覆うタイル座標一覧を返す
 * （事前キャッシュ対象タイルの列挙に用いる）。
 */
export function getTileCoordsForBounds(bounds: TileBounds, zoom: number): TileCoord[] {
  const topLeft = lngLatToTile(bounds.west, bounds.north, zoom);
  const bottomRight = lngLatToTile(bounds.east, bounds.south, zoom);

  const coords: TileCoord[] = [];
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      coords.push({ z: zoom, x, y });
    }
  }
  return coords;
}

export function buildTileUrl(urlTemplate: string, coord: TileCoord): string {
  return urlTemplate
    .replace("{z}", String(coord.z))
    .replace("{x}", String(coord.x))
    .replace("{y}", String(coord.y));
}
