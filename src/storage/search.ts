import type { Catalog, Item } from "../catalog/types";
import { normalizeItemName, sameItemRef, type LocalStorageItem, type StorageChest, type StorageItemRef } from "./types";

export { normalizeItemName as normalizeSearch };

export interface StorageSearchResult {
  ref: StorageItemRef;
  name: string;
  source: "catalog" | "local";
}

/** Searches official catalog items and player-created local items by normalized name/aliases. */
export function searchStorageItems(
  query: string,
  catalog: Catalog,
  localItems: LocalStorageItem[],
): StorageSearchResult[] {
  const q = normalizeItemName(query);
  const results: StorageSearchResult[] = [];
  if (!q) return results;
  for (const item of catalog.items) {
    if (normalizeItemName(item.name).includes(q))
      results.push({ ref: { kind: "catalog", itemId: item.id }, name: item.name, source: "catalog" });
  }
  for (const local of localItems) {
    if (local.mergedIntoLocalItemId) continue;
    const haystack = [local.normalizedName, ...local.aliases.map(normalizeItemName)].join(" ");
    if (haystack.includes(q))
      results.push({ ref: { kind: "local", localItemId: local.id }, name: local.name, source: "local" });
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function catalogItemMap(catalog: Catalog): Map<string, Item> {
  return new Map(catalog.items.map((item) => [item.id, item]));
}

export function resolveItemRefName(
  ref: StorageItemRef,
  catalog: Catalog,
  localItems: LocalStorageItem[],
): string {
  if (ref.kind === "catalog") {
    return catalog.items.find((item) => item.id === ref.itemId)?.name ?? "Unknown catalog item";
  }
  return localItems.find((item) => item.id === ref.localItemId)?.name ?? "Unknown local item";
}

/** Every chest where this item was last recorded — presence only, never a quantity or total. */
export function chestsForItemRef(ref: StorageItemRef, chests: StorageChest[]): StorageChest[] {
  return chests
    .filter((chest) => chest.itemRefs.some((candidate) => sameItemRef(candidate, ref)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function storageListHref(): string {
  return "#/storage";
}

export function storageNewHref(): string {
  return "#/storage/new";
}

export function storageChestHref(chestId: string): string {
  return `#/storage/${encodeURIComponent(chestId)}`;
}

/** Prefills the Storage search box from an item-detail "Find in storage" link. */
export function storageSearchHref(itemName: string): string {
  return `#/storage?q=${encodeURIComponent(itemName)}`;
}
