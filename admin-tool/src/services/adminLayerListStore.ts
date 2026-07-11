import type { LayerDefinition } from "../../../src/types/config";

/**
 * 主催者が編集中のレイヤー一覧をメモリ上で保持する（Requirement 11.1-11.3）。
 * 永続化はしない。編集結果はtoJson()でエクスポートし、Gitリポジトリに
 * コミットすることで学生側の地図に反映される（Requirement 11.6, 11.7）。
 */
export class AdminLayerListStore {
  private layers: LayerDefinition[] = [];

  load(layers: LayerDefinition[]): void {
    this.layers = [...layers];
  }

  list(): LayerDefinition[] {
    return this.layers;
  }

  upsert(layer: LayerDefinition): void {
    const index = this.layers.findIndex((l) => l.id === layer.id);
    if (index === -1) {
      this.layers = [...this.layers, layer];
    } else {
      this.layers = this.layers.map((l, i) => (i === index ? layer : l));
    }
  }

  remove(id: string): void {
    this.layers = this.layers.filter((l) => l.id !== id);
  }

  toJson(): string {
    return JSON.stringify(this.layers, null, 2);
  }
}
