import L from "leaflet";
import type { PointOfInterest, RoutePath, TourConfig } from "../types/config";

export interface OverlayMapLike {
  addLayer(layer: L.Layer): void;
  removeLayer(layer: L.Layer): void;
}

export type CreateMarker = (poi: PointOfInterest, onClick: () => void) => L.Layer;
export type CreatePolyline = (route: RoutePath) => L.Layer;

export interface PoiRouteOverlayOptions {
  map: OverlayMapLike;
  createMarker?: CreateMarker;
  createPolyline?: CreatePolyline;
  onSelectionChange?: (poiId: string | null) => void;
}

function defaultCreateMarker(poi: PointOfInterest, onClick: () => void): L.Layer {
  const marker = L.marker([poi.position.lat, poi.position.lng]);
  marker.on("click", onClick);
  return marker;
}

function defaultCreatePolyline(route: RoutePath): L.Layer {
  return L.polyline(route.points.map((point) => [point.lat, point.lng] as L.LatLngTuple));
}

export class PoiRouteOverlay {
  private readonly map: OverlayMapLike;
  private readonly createMarker: CreateMarker;
  private readonly createPolyline: CreatePolyline;
  private readonly onSelectionChange?: (poiId: string | null) => void;

  private layers: L.Layer[] = [];
  private openPoiId: string | null = null;
  private currentTour: TourConfig | null = null;

  constructor(options: PoiRouteOverlayOptions) {
    this.map = options.map;
    this.createMarker = options.createMarker ?? defaultCreateMarker;
    this.createPolyline = options.createPolyline ?? defaultCreatePolyline;
    this.onSelectionChange = options.onSelectionChange;
  }

  renderTour(tour: TourConfig): void {
    this.layers.forEach((layer) => this.map.removeLayer(layer));
    this.layers = [];
    this.currentTour = tour;
    if (this.openPoiId !== null) {
      this.closePoiDetail();
    }

    tour.pois.forEach((poi) => {
      const marker = this.createMarker(poi, () => this.openPoiDetail(poi.id));
      this.map.addLayer(marker);
      this.layers.push(marker);
    });

    tour.routes.forEach((route) => {
      const polyline = this.createPolyline(route);
      this.map.addLayer(polyline);
      this.layers.push(polyline);
    });
  }

  openPoiDetail(poiId: string): void {
    this.openPoiId = poiId;
    this.onSelectionChange?.(poiId);
  }

  closePoiDetail(): void {
    this.openPoiId = null;
    this.onSelectionChange?.(null);
  }

  getOpenPoiId(): string | null {
    return this.openPoiId;
  }

  getPoiById(poiId: string): PointOfInterest | undefined {
    return this.currentTour?.pois.find((poi) => poi.id === poiId);
  }
}
