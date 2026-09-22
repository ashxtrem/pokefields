import { db } from "../persistence/store";
import type { Catalog } from "../catalog/types";
import type { LocalStorageItem, StorageChest, StorageImage } from "./types";
import { readLocalStorageItem, readStorageChest } from "./migration";

export interface LoadResult<T> {
  items: T[];
  unreadableCount: number;
}

/** Rows that fail to read are skipped, not thrown — one bad chest must not blank the whole list. */
export async function loadAllChests(catalog: Catalog): Promise<LoadResult<StorageChest>> {
  const rows = await db.storageChests.toArray();
  const items: StorageChest[] = [];
  let unreadableCount = 0;
  for (const row of rows) {
    try {
      items.push(readStorageChest(row, catalog));
    } catch {
      unreadableCount += 1;
    }
  }
  return { items, unreadableCount };
}

export async function loadAllLocalItems(): Promise<LoadResult<LocalStorageItem>> {
  const rows = await db.storageLocalItems.toArray();
  const items: LocalStorageItem[] = [];
  let unreadableCount = 0;
  for (const row of rows) {
    try {
      items.push(readLocalStorageItem(row));
    } catch {
      unreadableCount += 1;
    }
  }
  return { items, unreadableCount };
}

export async function putChest(chest: StorageChest) {
  await db.storageChests.put(chest as unknown as Record<string, unknown>);
}

export async function deleteChestRow(id: string) {
  await db.storageChests.delete(id);
}

export async function putLocalItem(item: LocalStorageItem) {
  await db.storageLocalItems.put(item as unknown as Record<string, unknown>);
}

export async function deleteLocalItemRow(id: string) {
  await db.storageLocalItems.delete(id);
}

export async function putImage(image: StorageImage) {
  await db.storageImages.put(image as unknown as Record<string, unknown>);
}

export async function getImage(id: string): Promise<StorageImage | undefined> {
  return (await db.storageImages.get(id)) as StorageImage | undefined;
}

export async function deleteImageRow(id: string) {
  await db.storageImages.delete(id);
}

export async function allImageIds(): Promise<string[]> {
  return (await db.storageImages.toCollection().primaryKeys()) as string[];
}

export async function allImageRows(): Promise<StorageImage[]> {
  return (await db.storageImages.toArray()) as unknown as StorageImage[];
}

/** One Dexie transaction spanning every Storage table, for atomic multi-record operations. */
export async function storageTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction(
    "rw",
    db.storageChests,
    db.storageLocalItems,
    db.storageImages,
    fn,
  );
}

/** Narrower than replaceAllStorageData: used by undo, which must never touch the images table. */
export async function restoreChestsAndLocalItems(
  chests: StorageChest[],
  localItems: LocalStorageItem[],
): Promise<void> {
  await storageTransaction(async () => {
    await db.storageChests.clear();
    await db.storageLocalItems.clear();
    if (chests.length)
      await db.storageChests.bulkPut(chests as unknown as Record<string, unknown>[]);
    if (localItems.length)
      await db.storageLocalItems.bulkPut(localItems as unknown as Record<string, unknown>[]);
  });
}

export async function replaceAllStorageData(
  chests: StorageChest[],
  localItems: LocalStorageItem[],
  images: StorageImage[],
): Promise<void> {
  await storageTransaction(async () => {
    await db.storageChests.clear();
    await db.storageLocalItems.clear();
    await db.storageImages.clear();
    if (chests.length)
      await db.storageChests.bulkPut(chests as unknown as Record<string, unknown>[]);
    if (localItems.length)
      await db.storageLocalItems.bulkPut(localItems as unknown as Record<string, unknown>[]);
    if (images.length)
      await db.storageImages.bulkPut(images as unknown as Record<string, unknown>[]);
  });
}
