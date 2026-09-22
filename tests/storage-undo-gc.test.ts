import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { collectReferencedImageIds, garbageCollectImages } from "../src/storage/images";
import { db } from "../src/persistence/store";
import { putChest, putImage, putLocalItem } from "../src/storage/db";
import { buildLocalItem } from "../src/storage/localItems";
import { StorageUndoStack } from "../src/storage/undo";
import { emptyChest, type StorageChest, type StorageImage } from "../src/storage/types";

function testChest(overrides: Partial<StorageChest> = {}): StorageChest {
  return {
    ...emptyChest({ id: "chest:1", name: "Chest", regionId: "Bleak Beach", type: "storage-box", catalogVersion: "test" }),
    ...overrides,
  };
}

function testImage(id: string): StorageImage {
  return {
    id,
    kind: "location",
    ownerId: "chest:1",
    mimeType: "image/webp",
    width: 10,
    height: 10,
    byteLength: 4,
    blob: new Blob([new Uint8Array([1, 2, 3, 4])]),
    createdAt: new Date().toISOString(),
  };
}

beforeEach(async () => {
  await db.storageChests.clear();
  await db.storageLocalItems.clear();
  await db.storageImages.clear();
});

describe("StorageUndoStack", () => {
  it("restores the snapshot taken before the change", () => {
    const stack = new StorageUndoStack();
    const before = { chests: [testChest()], localItems: [] };
    stack.push("adding an item", before);
    const entry = stack.pop();
    expect(entry?.before).toEqual(before);
    expect(entry?.label).toBe("adding an item");
  });

  it("returns null once the stack is exhausted", () => {
    const stack = new StorageUndoStack();
    stack.push("a", { chests: [], localItems: [] });
    stack.pop();
    expect(stack.pop()).toBeNull();
  });

  it("protects images referenced by a live undo entry", () => {
    const stack = new StorageUndoStack();
    const chestWithImage = testChest({ locationImageId: "image:protected" });
    stack.push("editing", { chests: [chestWithImage], localItems: [] });
    expect(stack.protectedImageIds().has("image:protected")).toBe(true);
  });

  it("no longer protects images once the entry is consumed", () => {
    const stack = new StorageUndoStack();
    const chestWithImage = testChest({ locationImageId: "image:protected" });
    stack.push("editing", { chests: [chestWithImage], localItems: [] });
    stack.pop();
    expect(stack.protectedImageIds().has("image:protected")).toBe(false);
  });
});

describe("image garbage collection", () => {
  it("never deletes an image referenced by a current chest or local item", async () => {
    const chest = testChest({ locationImageId: "image:location" });
    const local = { ...buildLocalItem({ name: "Local" }), thumbnailImageId: "image:thumb" };
    await putChest(chest);
    await putLocalItem(local);
    await putImage(testImage("image:location"));
    await putImage(testImage("image:thumb"));
    await putImage(testImage("image:orphaned"));

    const referenced = collectReferencedImageIds([chest], [local]);
    const deleted = await garbageCollectImages(referenced);

    expect(deleted).toBe(1);
    expect(await db.storageImages.get("image:location")).toBeTruthy();
    expect(await db.storageImages.get("image:thumb")).toBeTruthy();
    expect(await db.storageImages.get("image:orphaned")).toBeUndefined();
  });

  it("never deletes an image protected by a live undo entry even if nothing currently references it", async () => {
    await putImage(testImage("image:undo-protected"));
    const referenced = collectReferencedImageIds([], [], ["image:undo-protected"]);
    const deleted = await garbageCollectImages(referenced);
    expect(deleted).toBe(0);
    expect(await db.storageImages.get("image:undo-protected")).toBeTruthy();
  });

  it("keeps unresolved-slot thumbnails referenced from a chest", async () => {
    const chest = testChest({
      unresolvedSlots: [{ id: "slot:1", imageId: "image:slot", page: 1, slot: 3 }],
    });
    await putImage(testImage("image:slot"));
    const referenced = collectReferencedImageIds([chest], []);
    expect(referenced.has("image:slot")).toBe(true);
  });
});
