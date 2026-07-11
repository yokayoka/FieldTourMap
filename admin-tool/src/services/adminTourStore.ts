import type { PointOfInterest, RoutePath, TourConfig } from "../../../src/types/config";

export interface TourMetadata {
  id: string;
  title: string;
  description: string;
  layerIds: string[];
}

/**
 * 主催者が編集中のツアー（POI・ルート・メタデータ）をメモリ上で保持する
 * （Requirement 4, 4.1, 4.2, 11）。永続化はせず、toJson()でエクスポートし
 * Gitリポジトリにコミットすることで学生側の地図に反映される。
 */
export class AdminTourStore {
  private metadata: TourMetadata = { id: "", title: "", description: "", layerIds: [] };
  private pois: PointOfInterest[] = [];
  private routes: RoutePath[] = [];

  load(tour: TourConfig): void {
    this.metadata = {
      id: tour.id,
      title: tour.title,
      description: tour.description ?? "",
      layerIds: [...tour.layerIds],
    };
    this.pois = [...tour.pois];
    this.routes = [...tour.routes];
  }

  getMetadata(): TourMetadata {
    return this.metadata;
  }

  setMetadata(fields: Partial<TourMetadata>): void {
    this.metadata = { ...this.metadata, ...fields };
  }

  listPois(): PointOfInterest[] {
    return this.pois;
  }

  upsertPoi(poi: PointOfInterest): void {
    const index = this.pois.findIndex((p) => p.id === poi.id);
    this.pois = index === -1 ? [...this.pois, poi] : this.pois.map((p, i) => (i === index ? poi : p));
  }

  removePoi(id: string): void {
    this.pois = this.pois.filter((p) => p.id !== id);
  }

  listRoutes(): RoutePath[] {
    return this.routes;
  }

  upsertRoute(route: RoutePath): void {
    const index = this.routes.findIndex((r) => r.id === route.id);
    this.routes =
      index === -1 ? [...this.routes, route] : this.routes.map((r, i) => (i === index ? route : r));
  }

  removeRoute(id: string): void {
    this.routes = this.routes.filter((r) => r.id !== id);
  }

  toTourConfig(): TourConfig {
    return {
      id: this.metadata.id,
      title: this.metadata.title,
      description: this.metadata.description,
      layerIds: this.metadata.layerIds,
      pois: this.pois,
      routes: this.routes,
    };
  }

  toJson(): string {
    return JSON.stringify(this.toTourConfig(), null, 2);
  }
}
