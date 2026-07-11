export interface LatLng {
  lat: number;
  lng: number;
}

export type LayerType = "base" | "overlay";

export interface LayerDefinition {
  id: string;
  name: string;
  type: LayerType;
  urlTemplate: string;
  attribution: string;
  opacity: number;
  minZoom: number;
  maxZoom: number;
  defaultVisible: boolean;
}

export type MediaType = "photo" | "video";

export interface MediaLink {
  url: string;
  caption: string;
  type: MediaType;
}

export interface ReferencePaper {
  url: string;
  citation: string;
}

export interface PointOfInterest {
  id: string;
  name: string;
  description: string;
  position: LatLng;
  media: MediaLink[];
  referencePapers: ReferencePaper[];
}

export interface RoutePath {
  id: string;
  name: string;
  points: LatLng[];
}

export interface TourConfig {
  id: string;
  title: string;
  description?: string;
  layerIds: string[];
  pois: PointOfInterest[];
  routes: RoutePath[];
}

export interface ObservationMemo {
  id: string;
  position: LatLng;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShareViewState {
  lat: number;
  lng: number;
  zoom: number;
  baseLayerId: string;
  overlayLayerIds: string[];
  poiId?: string;
}

export interface GoogleMapsLinkParams {
  lat: number;
  lng: number;
}
