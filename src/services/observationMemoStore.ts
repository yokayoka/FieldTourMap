import type { LatLng, ObservationMemo } from "../types/config";

export interface ObservationMemoStoreOptions {
  storage?: Storage;
  storageKey?: string;
  generateId?: () => string;
  now?: () => string;
}

export interface AddMemoInput {
  position: LatLng;
  text: string;
}

const DEFAULT_STORAGE_KEY = "fieldtour.memos.v1";

function defaultGenerateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `memo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class ObservationMemoStore {
  private readonly storage?: Storage;
  private readonly storageKey: string;
  private readonly generateId: () => string;
  private readonly now: () => string;
  private memos: ObservationMemo[];

  constructor(options: ObservationMemoStoreOptions = {}) {
    this.storage = options.storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.generateId = options.generateId ?? defaultGenerateId;
    this.now = options.now ?? (() => new Date().toISOString());
    this.memos = this.readPersisted();
  }

  private readPersisted(): ObservationMemo[] {
    if (!this.storage) return [];
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as ObservationMemo[]) : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.memos));
    } catch (error) {
      console.warn("観察メモの保存に失敗しました", error);
    }
  }

  add(input: AddMemoInput): ObservationMemo {
    const timestamp = this.now();
    const memo: ObservationMemo = {
      id: this.generateId(),
      position: input.position,
      text: input.text,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.memos = [...this.memos, memo];
    this.persist();
    return memo;
  }

  update(id: string, text: string): void {
    const index = this.memos.findIndex((memo) => memo.id === id);
    if (index === -1) return;
    this.memos = this.memos.map((memo, i) =>
      i === index ? { ...memo, text, updatedAt: this.now() } : memo,
    );
    this.persist();
  }

  delete(id: string): void {
    this.memos = this.memos.filter((memo) => memo.id !== id);
    this.persist();
  }

  list(): ObservationMemo[] {
    return this.memos;
  }

  exportAsGeoJson(): string {
    return JSON.stringify({
      type: "FeatureCollection",
      features: this.memos.map((memo) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [memo.position.lng, memo.position.lat] },
        properties: {
          id: memo.id,
          text: memo.text,
          createdAt: memo.createdAt,
          updatedAt: memo.updatedAt,
        },
      })),
    });
  }

  exportAsCsv(): string {
    const header = "id,lat,lng,text,createdAt,updatedAt";
    const rows = this.memos.map((memo) =>
      [
        memo.id,
        String(memo.position.lat),
        String(memo.position.lng),
        escapeCsvField(memo.text),
        memo.createdAt,
        memo.updatedAt,
      ].join(","),
    );
    return [header, ...rows].join("\r\n");
  }
}

function escapeCsvField(value: string): string {
  // text列は自由記述でカンマ・改行等を含み得るため常にダブルクォートで
  // 囲み、内部のダブルクォートは二重化してエスケープする（RFC 4180準拠）。
  return `"${value.replace(/"/g, '""')}"`;
}
