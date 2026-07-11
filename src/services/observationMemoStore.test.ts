import { describe, expect, it, vi } from "vitest";
import { ObservationMemoStore } from "./observationMemoStore";

function createFakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

function createStore(overrides?: { storage?: Storage }) {
  let nextId = 1;
  let nextTime = 0;
  const storage = overrides?.storage ?? createFakeStorage();
  const store = new ObservationMemoStore({
    storage,
    storageKey: "fieldtour.memos.test",
    generateId: () => `memo-${nextId++}`,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, nextTime++)).toISOString(),
  });
  return { store, storage };
}

describe("ObservationMemoStore", () => {
  it("returns an empty list initially", () => {
    const { store } = createStore();
    expect(store.list()).toEqual([]);
  });

  it("adds a memo with a generated id and timestamps", () => {
    const { store } = createStore();

    const memo = store.add({ position: { lat: 35.68, lng: 139.76 }, text: "露頭のスケッチ" });

    expect(memo).toEqual({
      id: "memo-1",
      position: { lat: 35.68, lng: 139.76 },
      text: "露頭のスケッチ",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(store.list()).toEqual([memo]);
  });

  it("persists added memos across store instances sharing the same storage", () => {
    const { store, storage } = createStore();
    store.add({ position: { lat: 35.68, lng: 139.76 }, text: "メモ1" });

    const { store: reopened } = createStore({ storage });

    expect(reopened.list()).toHaveLength(1);
    expect(reopened.list()[0].text).toBe("メモ1");
  });

  it("updates a memo's text and updatedAt without changing createdAt", () => {
    const { store } = createStore();
    const memo = store.add({ position: { lat: 35.68, lng: 139.76 }, text: "元のテキスト" });

    store.update(memo.id, "更新後のテキスト");

    const updated = store.list()[0];
    expect(updated.text).toBe("更新後のテキスト");
    expect(updated.createdAt).toBe(memo.createdAt);
    expect(updated.updatedAt).not.toBe(memo.createdAt);
  });

  it("does nothing when updating a non-existent memo id", () => {
    const { store } = createStore();
    store.add({ position: { lat: 35.68, lng: 139.76 }, text: "メモ" });

    expect(() => store.update("unknown-id", "x")).not.toThrow();
    expect(store.list()).toHaveLength(1);
  });

  it("updates only the targeted memo when multiple memos exist", () => {
    const { store } = createStore();
    const memo1 = store.add({ position: { lat: 35.68, lng: 139.76 }, text: "メモ1" });
    const memo2 = store.add({ position: { lat: 35.69, lng: 139.77 }, text: "メモ2" });

    store.update(memo2.id, "メモ2（更新）");

    const [updated1, updated2] = store.list();
    expect(updated1).toEqual(memo1);
    expect(updated2.text).toBe("メモ2（更新）");
  });

  it("deletes a memo by id", () => {
    const { store } = createStore();
    const memo1 = store.add({ position: { lat: 35.68, lng: 139.76 }, text: "メモ1" });
    store.add({ position: { lat: 35.69, lng: 139.77 }, text: "メモ2" });

    store.delete(memo1.id);

    expect(store.list()).toHaveLength(1);
    expect(store.list()[0].text).toBe("メモ2");
  });

  it("recovers gracefully from corrupted storage content", () => {
    const storage = createFakeStorage();
    storage.setItem("fieldtour.memos.test", "{not valid json");

    const { store } = createStore({ storage });

    expect(store.list()).toEqual([]);
  });

  it("recovers gracefully when persisted content is valid JSON but not an array", () => {
    const storage = createFakeStorage();
    storage.setItem("fieldtour.memos.test", JSON.stringify({ not: "an array" }));

    const { store } = createStore({ storage });

    expect(store.list()).toEqual([]);
  });

  it("uses real localStorage and the default storage key when no options are given", () => {
    localStorage.clear();
    try {
      const store = new ObservationMemoStore();
      store.add({ position: { lat: 0, lng: 0 }, text: "デフォルト設定の確認" });

      expect(localStorage.getItem("fieldtour.memos.v1")).toContain("デフォルト設定の確認");
    } finally {
      localStorage.clear();
    }
  });

  it("does not throw when persisting fails (e.g. storage quota exceeded / private browsing)", () => {
    const throwingStorage: Storage = {
      ...createFakeStorage(),
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
    };
    const { store } = createStore({ storage: throwingStorage });

    expect(() =>
      store.add({ position: { lat: 35.68, lng: 139.76 }, text: "メモ" }),
    ).not.toThrow();
    expect(store.list()).toHaveLength(1);
  });

  describe("default id generation (no generateId override)", () => {
    it("uses crypto.randomUUID when available", () => {
      const store = new ObservationMemoStore({
        storage: createFakeStorage(),
        storageKey: "fieldtour.memos.test",
      });

      const memo = store.add({ position: { lat: 0, lng: 0 }, text: "x" });

      expect(memo.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("falls back to a timestamp/random id when crypto.randomUUID is unavailable", () => {
      const originalCrypto = globalThis.crypto;
      // @ts-expect-error -- randomUUID非対応環境をシミュレートするため意図的に削除する
      delete globalThis.crypto;

      try {
        const store = new ObservationMemoStore({
          storage: createFakeStorage(),
          storageKey: "fieldtour.memos.test",
        });
        const memo = store.add({ position: { lat: 0, lng: 0 }, text: "x" });

        expect(memo.id).toMatch(/^memo-\d+-[0-9a-f]+$/);
      } finally {
        vi.stubGlobal("crypto", originalCrypto);
      }
    });
  });

  describe("exportAsGeoJson", () => {
    it("returns an empty FeatureCollection when there are no memos", () => {
      const { store } = createStore();

      expect(JSON.parse(store.exportAsGeoJson())).toEqual({
        type: "FeatureCollection",
        features: [],
      });
    });

    it("exports memos as Point features with [lng, lat] coordinate order", () => {
      const { store } = createStore();
      store.add({ position: { lat: 35.68, lng: 139.76 }, text: "露頭のスケッチ" });

      const geoJson = JSON.parse(store.exportAsGeoJson());

      expect(geoJson).toEqual({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [139.76, 35.68] },
            properties: {
              id: "memo-1",
              text: "露頭のスケッチ",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          },
        ],
      });
    });
  });

  describe("exportAsCsv", () => {
    it("returns just the header row when there are no memos", () => {
      const { store } = createStore();

      expect(store.exportAsCsv()).toBe("id,lat,lng,text,createdAt,updatedAt");
    });

    it("exports memos as CSV rows", () => {
      const { store } = createStore();
      store.add({ position: { lat: 35.68, lng: 139.76 }, text: "露頭のスケッチ" });

      const lines = store.exportAsCsv().split("\r\n");

      expect(lines[0]).toBe("id,lat,lng,text,createdAt,updatedAt");
      expect(lines[1]).toBe(
        'memo-1,35.68,139.76,"露頭のスケッチ",2026-01-01T00:00:00.000Z,2026-01-01T00:00:00.000Z',
      );
    });

    it("escapes commas, quotes, and newlines in memo text", () => {
      const { store } = createStore();
      store.add({ position: { lat: 0, lng: 0 }, text: 'カンマ,と"引用符"と\n改行' });

      const csv = store.exportAsCsv();

      expect(csv).toContain('"カンマ,と""引用符""と\n改行"');
    });
  });
});
