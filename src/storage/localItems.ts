import type { Catalog } from "../catalog/types";
import {
  makeLocalItemId,
  normalizeItemName,
  type LocalStorageItem,
  type StorageChest,
} from "./types";

/** Pure local-item builders/mutators — no Dexie access, see repository.ts's header comment. */

export type NameCollision =
  | { kind: "catalog"; itemId: string; name: string }
  | { kind: "local"; localItemId: string; name: string };

/** Warn before creation when another local or official item already has this normalized name. */
export function findNameCollision(
  name: string,
  catalog: Catalog,
  localItems: LocalStorageItem[],
): NameCollision | null {
  const normalized = normalizeItemName(name);
  const catalogHit = catalog.items.find((item) => normalizeItemName(item.name) === normalized);
  if (catalogHit) return { kind: "catalog", itemId: catalogHit.id, name: catalogHit.name };
  const localHit = localItems.find(
    (item) => !item.mergedIntoLocalItemId && item.normalizedName === normalized,
  );
  if (localHit) return { kind: "local", localItemId: localHit.id, name: localHit.name };
  return null;
}

export function buildLocalItem(fields: {
  name: string;
  note?: string;
  thumbnailImageId?: string;
}): LocalStorageItem {
  const now = new Date().toISOString();
  const name = fields.name.trim();
  if (!name) throw new Error("A local item needs a name.");
  return {
    version: 1,
    id: makeLocalItemId(),
    name,
    normalizedName: normalizeItemName(name),
    aliases: [],
    note: fields.note,
    thumbnailImageId: fields.thumbnailImageId,
    createdAt: now,
    updatedAt: now,
  };
}

function touch(item: LocalStorageItem): LocalStorageItem {
  return { ...item, updatedAt: new Date().toISOString() };
}

export function renameLocalItem(item: LocalStorageItem, name: string): LocalStorageItem {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A local item needs a name.");
  return touch({
    ...item,
    name: trimmed,
    normalizedName: normalizeItemName(trimmed),
    aliases: item.aliases.includes(item.normalizedName)
      ? item.aliases
      : [...item.aliases, item.normalizedName],
  });
}

export function editLocalItemNote(item: LocalStorageItem, note: string): LocalStorageItem {
  return touch({ ...item, note: note.trim() || undefined });
}

export function setLocalItemThumbnail(
  item: LocalStorageItem,
  thumbnailImageId: string | undefined,
): LocalStorageItem {
  return touch({ ...item, thumbnailImageId });
}

export function isLocalItemReferenced(localItemId: string, chests: StorageChest[]): boolean {
  return chests.some((chest) =>
    chest.itemRefs.some((ref) => ref.kind === "local" && ref.localItemId === localItemId),
  );
}

export function chestsReferencingLocalItem(
  localItemId: string,
  chests: StorageChest[],
): StorageChest[] {
  return chests.filter((chest) =>
    chest.itemRefs.some((ref) => ref.kind === "local" && ref.localItemId === localItemId),
  );
}

/** Rewrites every chest's item references from one local item id to another (merge target). */
export function rewriteChestsForMerge(
  chests: StorageChest[],
  fromLocalItemId: string,
  toLocalItemId: string,
): StorageChest[] {
  return chests.map((chest) => {
    if (!chest.itemRefs.some((ref) => ref.kind === "local" && ref.localItemId === fromLocalItemId))
      return chest;
    const mapped = chest.itemRefs.map((ref) =>
      ref.kind === "local" && ref.localItemId === fromLocalItemId
        ? ({ kind: "local", localItemId: toLocalItemId } as const)
        : ref,
    );
    // presence-only: drop any duplicate created by merging into an already-present item, keeping
    // the first occurrence of each key (a plain Set pre-seeded from the pre-merge refs would wrongly
    // treat the surviving original "to" reference as a duplicate of itself).
    const seen = new Set<string>();
    const rewritten = mapped.filter((ref) => {
      const key = ref.kind === "catalog" ? `catalog:${ref.itemId}` : `local:${ref.localItemId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { ...chest, itemRefs: rewritten, updatedAt: new Date().toISOString() };
  });
}

/** Rewrites every chest's item references from a local item to its confirmed catalog link. */
export function rewriteChestsForCatalogLink(
  chests: StorageChest[],
  localItemId: string,
  catalogItemId: string,
): StorageChest[] {
  return chests.map((chest) => {
    if (!chest.itemRefs.some((ref) => ref.kind === "local" && ref.localItemId === localItemId))
      return chest;
    const seen = new Set<string>();
    const rewritten = chest.itemRefs
      .map((ref) => (ref.kind === "local" && ref.localItemId === localItemId
        ? ({ kind: "catalog", itemId: catalogItemId } as const)
        : ref))
      .filter((ref) => {
        const key = ref.kind === "catalog" ? `catalog:${ref.itemId}` : `local:${ref.localItemId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return { ...chest, itemRefs: rewritten, updatedAt: new Date().toISOString() };
  });
}

export function markMergedInto(item: LocalStorageItem, targetId: string): LocalStorageItem {
  return touch({ ...item, mergedIntoLocalItemId: targetId });
}

export function markLinkedToCatalog(item: LocalStorageItem, catalogItemId: string): LocalStorageItem {
  return touch({ ...item, linkedCatalogItemId: catalogItemId });
}
