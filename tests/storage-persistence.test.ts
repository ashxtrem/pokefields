import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Catalog, Item } from "../src/catalog/types";
import { db, emptyState } from "../src/persistence/store";
import {
  buildBackupEnvelope,
  validateBackupEnvelope,
  type BackupEnvelopeV2,
} from "../src/storage/backup";
import { loadAllChests, loadAllLocalItems, putChest, putLocalItem, putImage, replaceAllStorageData } from "../src/storage/db";
import { readLocalStorageItem, readStorageChest } from "../src/storage/migration";
import { buildLocalItem } from "../src/storage/localItems";
import { emptyChest, type StorageChest, type StorageImage } from "../src/storage/types";

const catalog: Catalog = {
  version: "test",
  pokemon: [],
  kits: [],
  items: [{ id: "nugget", name: "Nugget", categories: [], source: "https://example.com" } satisfies Item],
  areas: ["Bleak Beach"],
  sources: [],
};

function testChest(): StorageChest {
  return emptyChest({
    id: "chest:1",
    name: "Test chest",
    regionId: "Bleak Beach",
    type: "storage-box",
    catalogVersion: "test",
  });
}

function testImage(id: string, ownerId: string): StorageImage {
  return {
    id,
    kind: "location",
    ownerId,
    mimeType: "image/webp",
    width: 10,
    height: 10,
    byteLength: 4,
    blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/webp" }),
    createdAt: new Date().toISOString(),
  };
}

beforeEach(async () => {
  await db.storageChests.clear();
  await db.storageLocalItems.clear();
  await db.storageImages.clear();
});

describe("StorageChest / LocalStorageItem readers", () => {
  it("rejects a record from a newer version than this app understands", () => {
    expect(() => readStorageChest({ ...testChest(), version: 2 }, catalog)).toThrow(/newer format/);
  });

  it("rejects a chest with an unrecognized region", () => {
    expect(() => readStorageChest({ ...testChest(), regionId: "Nowhere" }, catalog)).toThrow(/region/);
  });

  it("rejects duplicate item references within one chest", () => {
    const chest = { ...testChest(), itemRefs: [{ kind: "catalog", itemId: "nugget" }, { kind: "catalog", itemId: "nugget" }] };
    expect(() => readStorageChest(chest, catalog)).toThrow(/duplicate/);
  });

  it("round-trips an item reference's optional quantity", () => {
    const chest = { ...testChest(), itemRefs: [{ kind: "catalog", itemId: "nugget", quantity: 3 }] };
    expect(readStorageChest(chest, catalog).itemRefs).toEqual([{ kind: "catalog", itemId: "nugget", quantity: 3 }]);
  });

  it("rejects a non-whole or non-positive quantity", () => {
    const zero = { ...testChest(), itemRefs: [{ kind: "catalog", itemId: "nugget", quantity: 0 }] };
    expect(() => readStorageChest(zero, catalog)).toThrow(/quantity/);
    const fractional = { ...testChest(), itemRefs: [{ kind: "catalog", itemId: "nugget", quantity: 1.5 }] };
    expect(() => readStorageChest(fractional, catalog)).toThrow(/quantity/);
  });

  it("round-trips a valid local item", () => {
    const item = buildLocalItem({ name: "Mystery gadget" });
    expect(readLocalStorageItem(JSON.parse(JSON.stringify(item)))).toEqual(item);
  });
});

describe("backup envelope v2", () => {
  it("round-trips chests, local items, and images through export/import", async () => {
    const local = buildLocalItem({ name: "Future DLC item" });
    const chest = { ...testChest(), itemRefs: [{ kind: "local" as const, localItemId: local.id, quantity: 7 }] };
    const image = testImage("image:1", chest.id);
    const envelope = await buildBackupEnvelope(emptyState(), [chest], [local], [image]);
    expect(envelope.envelopeVersion).toBe(2);

    const raw = JSON.parse(JSON.stringify(envelope));
    const parsed = validateBackupEnvelope(raw, catalog);
    expect(parsed.storage?.chests).toEqual([chest]);
    expect(parsed.storage?.chests[0]?.itemRefs[0]).toEqual({ kind: "local", localItemId: local.id, quantity: 7 });
    expect(parsed.storage?.localItems).toEqual([local]);
    expect(parsed.storage?.images[0]?.id).toBe("image:1");
  });

  it("imports a legacy bare-SaveState backup with no Storage data", () => {
    const legacy = { schemaVersion: 1 as const, found: {}, plans: {} };
    const parsed = validateBackupEnvelope(legacy, catalog);
    expect(parsed.storage).toBeNull();
    expect(parsed.state.schemaVersion).toBe(1);
  });

  it("rejects a chest referencing a local item that is not in the same backup", () => {
    const chest = { ...testChest(), itemRefs: [{ kind: "local" as const, localItemId: "local:missing" }] };
    const raw: BackupEnvelopeV2 = {
      envelopeVersion: 2,
      state: emptyState(),
      storage: { featureVersion: 1, chests: [chest], localItems: [], images: [] },
    };
    expect(() => validateBackupEnvelope(raw, catalog)).toThrow(/missing local item/);
  });

  it("rejects a chest referencing an image that is not in the same backup", () => {
    const chest = { ...testChest(), locationImageId: "image:missing" };
    const raw: BackupEnvelopeV2 = {
      envelopeVersion: 2,
      state: emptyState(),
      storage: { featureVersion: 1, chests: [chest], localItems: [], images: [] },
    };
    expect(() => validateBackupEnvelope(raw, catalog)).toThrow(/location image/);
  });

  it("a failed validation never touches the database (validate fully before any write)", async () => {
    await putChest(testChest());
    const badChest = { ...testChest(), id: "chest:2", regionId: "Nowhere" };
    const raw: BackupEnvelopeV2 = {
      envelopeVersion: 2,
      state: emptyState(),
      storage: { featureVersion: 1, chests: [badChest], localItems: [], images: [] },
    };
    expect(() => validateBackupEnvelope(raw, catalog)).toThrow();
    const current = await loadAllChests(catalog);
    expect(current.items.map((c) => c.id)).toEqual(["chest:1"]);
  });
});

describe("Dexie table round trips and quarantine-on-read", () => {
  it("writes and reads chests, local items, and images", async () => {
    const chest = testChest();
    const local = buildLocalItem({ name: "Saved item" });
    const image = testImage("image:2", chest.id);
    await putChest(chest);
    await putLocalItem(local);
    await putImage(image);

    const chests = await loadAllChests(catalog);
    const localItems = await loadAllLocalItems();
    expect(chests.items).toEqual([chest]);
    expect(chests.unreadableCount).toBe(0);
    expect(localItems.items).toEqual([local]);
  });

  it("skips an unreadable row instead of failing the whole list", async () => {
    await putChest(testChest());
    await db.storageChests.put({ id: "chest:corrupt", not: "a valid chest" });
    const result = await loadAllChests(catalog);
    expect(result.items.map((c) => c.id)).toEqual(["chest:1"]);
    expect(result.unreadableCount).toBe(1);
  });

  it("replaceAllStorageData clears and replaces every table atomically", async () => {
    await putChest(testChest());
    const nextChest = { ...testChest(), id: "chest:new" };
    await replaceAllStorageData([nextChest], [], []);
    const result = await loadAllChests(catalog);
    expect(result.items.map((c) => c.id)).toEqual(["chest:new"]);
  });
});
