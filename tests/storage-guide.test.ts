import { beforeEach, describe, expect, it } from "vitest";

// Vitest's default (Node) test environment has no `localStorage` global — there's no existing
// polyfill dependency in this repo (unlike fake-indexeddb for IndexedDB), so this is a minimal
// in-memory stand-in, installed before importing the module under test.
class FakeStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.localStorage = new FakeStorage() as unknown as Storage;

const { hasSeenStorageGuide, markStorageGuideSeen } = await import("../src/storage/StorageGuide");

describe("storage guide seen-state", () => {
  beforeEach(() => {
    (globalThis.localStorage as unknown as FakeStorage).clear();
  });

  it("reports unseen before it has ever been marked", () => {
    expect(hasSeenStorageGuide()).toBe(false);
  });

  it("reports seen once, and stays seen, after marking", () => {
    markStorageGuideSeen();
    expect(hasSeenStorageGuide()).toBe(true);
    // Marking again (e.g. clicking the Guide button later) must not un-mark it.
    markStorageGuideSeen();
    expect(hasSeenStorageGuide()).toBe(true);
  });

  it("does not throw when localStorage access fails", () => {
    const original = globalThis.localStorage;
    globalThis.localStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(() => hasSeenStorageGuide()).not.toThrow();
    expect(hasSeenStorageGuide()).toBe(false);
    expect(() => markStorageGuideSeen()).not.toThrow();
    globalThis.localStorage = original;
  });
});
