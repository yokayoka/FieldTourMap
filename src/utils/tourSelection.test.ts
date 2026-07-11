import { describe, expect, it, vi } from "vitest";
import { readSelectedTourId, writeSelectedTourId } from "./tourSelection";

function createFakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe("tourSelection", () => {
  it("returns null when nothing has been saved", () => {
    expect(readSelectedTourId(createFakeStorage())).toBeNull();
  });

  it("round-trips a written tour id", () => {
    const storage = createFakeStorage();
    writeSelectedTourId(storage, "sample-tour");
    expect(readSelectedTourId(storage)).toBe("sample-tour");
  });

  it("does not throw when storage.getItem throws", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    } as unknown as Storage;

    expect(readSelectedTourId(storage)).toBeNull();
  });

  it("does not throw when storage.setItem throws", () => {
    const storage = {
      setItem: vi.fn(() => {
        throw new Error("quota exceeded");
      }),
    } as unknown as Storage;

    expect(() => writeSelectedTourId(storage, "sample-tour")).not.toThrow();
  });
});
