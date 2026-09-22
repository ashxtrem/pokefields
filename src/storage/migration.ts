import type { Catalog } from "../catalog/types";
import {
  STORAGE_CHEST_VERSION,
  LOCAL_STORAGE_ITEM_VERSION,
  type ChestType,
  type LocalStorageItem,
  type StorageChest,
  type StorageItemRef,
  type UnresolvedSlot,
} from "./types";

/**
 * Strict readers for StorageChest/LocalStorageItem rows, mirroring
 * src/crafting/migration.ts's "one strict reader, version-gated, never crashes the notebook"
 * pattern (D-MIG-01). Used by backup import (untrusted JSON) and, more leniently, by
 * src/storage/repository.ts when loading Dexie rows (a row that fails to read is skipped rather
 * than aborting the whole list — there is no single blob to quarantine here since each chest/local
 * item is already its own addressable Dexie row).
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}

function readItemRef(raw: unknown, index: number): StorageItemRef {
  if (!isObject(raw)) fail(`Chest item reference ${index} is invalid.`);
  if (raw.kind === "catalog") {
    if (typeof raw.itemId !== "string" || !raw.itemId)
      fail(`Chest item reference ${index} has an invalid catalog item id.`);
    return { kind: "catalog", itemId: raw.itemId };
  }
  if (raw.kind === "local") {
    if (typeof raw.localItemId !== "string" || !raw.localItemId)
      fail(`Chest item reference ${index} has an invalid local item id.`);
    return { kind: "local", localItemId: raw.localItemId };
  }
  fail(`Chest item reference ${index} has an unknown kind.`);
}

function readUnresolvedSlot(raw: unknown, index: number): UnresolvedSlot {
  if (
    !isObject(raw) ||
    typeof raw.id !== "string" ||
    !raw.id ||
    typeof raw.imageId !== "string" ||
    !raw.imageId ||
    !Number.isInteger(raw.page) ||
    (raw.page as number) < 1 ||
    !Number.isInteger(raw.slot) ||
    (raw.slot as number) < 1
  )
    fail(`Unresolved slot ${index} is invalid.`);
  return {
    id: raw.id as string,
    imageId: raw.imageId as string,
    page: raw.page as number,
    slot: raw.slot as number,
  };
}

export function readStorageChest(raw: unknown, catalog: Catalog): StorageChest {
  if (!isObject(raw)) fail("A chest record is invalid.");
  if (typeof raw.version === "number" && raw.version > STORAGE_CHEST_VERSION)
    fail("A chest record uses a newer format than this app understands.");
  if (raw.version !== STORAGE_CHEST_VERSION) fail("A chest record has an unsupported version.");
  if (typeof raw.id !== "string" || !raw.id) fail("A chest record is missing its id.");
  if (typeof raw.name !== "string" || !raw.name.trim()) fail("A chest needs a name.");
  if (typeof raw.regionId !== "string" || !catalog.areas.includes(raw.regionId))
    fail("A chest has an unrecognized region.");
  if (raw.type !== "storage-box" && raw.type !== "big-storage-box")
    fail("A chest has an invalid type.");
  if (raw.locationNote !== undefined && typeof raw.locationNote !== "string")
    fail("A chest has an invalid location note.");
  if (raw.locationImageId !== undefined && typeof raw.locationImageId !== "string")
    fail("A chest has an invalid location image reference.");
  if (
    raw.locationMarker !== undefined &&
    (!isObject(raw.locationMarker) ||
      typeof raw.locationMarker.x !== "number" ||
      typeof raw.locationMarker.y !== "number")
  )
    fail("A chest has an invalid location marker.");
  if (!Array.isArray(raw.itemRefs)) fail("A chest has invalid item references.");
  const itemRefs = raw.itemRefs.map((entry, index) => readItemRef(entry, index));
  const keys = new Set(itemRefs.map((ref) => (ref.kind === "catalog" ? `c:${ref.itemId}` : `l:${ref.localItemId}`)));
  if (keys.size !== itemRefs.length) fail("A chest has duplicate item references.");
  let unresolvedSlots: UnresolvedSlot[] | undefined;
  if (raw.unresolvedSlots !== undefined) {
    if (!Array.isArray(raw.unresolvedSlots)) fail("A chest has invalid unresolved slots.");
    unresolvedSlots = raw.unresolvedSlots.map((entry, index) => readUnresolvedSlot(entry, index));
  }
  if (typeof raw.createdAt !== "string" || !raw.createdAt) fail("A chest is missing its created date.");
  if (typeof raw.updatedAt !== "string" || !raw.updatedAt) fail("A chest is missing its updated date.");
  if (raw.lastCompleteScanAt !== undefined && typeof raw.lastCompleteScanAt !== "string")
    fail("A chest has an invalid last-complete-scan date.");
  if (
    raw.lastScanKind !== undefined &&
    raw.lastScanKind !== "manual" &&
    raw.lastScanKind !== "partial" &&
    raw.lastScanKind !== "complete"
  )
    fail("A chest has an invalid scan kind.");
  if (typeof raw.catalogVersion !== "string" || !raw.catalogVersion)
    fail("A chest is missing its catalog version.");
  return {
    version: STORAGE_CHEST_VERSION,
    id: raw.id,
    name: raw.name,
    regionId: raw.regionId,
    type: raw.type as ChestType,
    locationNote: raw.locationNote as string | undefined,
    locationImageId: raw.locationImageId as string | undefined,
    locationMarker: raw.locationMarker as { x: number; y: number } | undefined,
    itemRefs,
    unresolvedSlots,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    lastCompleteScanAt: raw.lastCompleteScanAt as string | undefined,
    lastScanKind: raw.lastScanKind as StorageChest["lastScanKind"],
    catalogVersion: raw.catalogVersion,
  };
}

export function readLocalStorageItem(raw: unknown): LocalStorageItem {
  if (!isObject(raw)) fail("A local item record is invalid.");
  if (typeof raw.version === "number" && raw.version > LOCAL_STORAGE_ITEM_VERSION)
    fail("A local item record uses a newer format than this app understands.");
  if (raw.version !== LOCAL_STORAGE_ITEM_VERSION) fail("A local item record has an unsupported version.");
  if (typeof raw.id !== "string" || !raw.id.startsWith("local:")) fail("A local item is missing a valid id.");
  if (typeof raw.name !== "string" || !raw.name.trim()) fail("A local item needs a name.");
  if (typeof raw.normalizedName !== "string" || !raw.normalizedName)
    fail("A local item is missing its normalized name.");
  if (!Array.isArray(raw.aliases) || raw.aliases.some((a) => typeof a !== "string"))
    fail("A local item has invalid aliases.");
  if (raw.note !== undefined && typeof raw.note !== "string") fail("A local item has an invalid note.");
  if (raw.thumbnailImageId !== undefined && typeof raw.thumbnailImageId !== "string")
    fail("A local item has an invalid thumbnail reference.");
  if (raw.linkedCatalogItemId !== undefined && typeof raw.linkedCatalogItemId !== "string")
    fail("A local item has an invalid catalog link.");
  if (raw.mergedIntoLocalItemId !== undefined && typeof raw.mergedIntoLocalItemId !== "string")
    fail("A local item has an invalid merge target.");
  if (typeof raw.createdAt !== "string" || !raw.createdAt) fail("A local item is missing its created date.");
  if (typeof raw.updatedAt !== "string" || !raw.updatedAt) fail("A local item is missing its updated date.");
  return {
    version: LOCAL_STORAGE_ITEM_VERSION,
    id: raw.id,
    name: raw.name,
    normalizedName: raw.normalizedName,
    aliases: raw.aliases as string[],
    note: raw.note as string | undefined,
    thumbnailImageId: raw.thumbnailImageId as string | undefined,
    linkedCatalogItemId: raw.linkedCatalogItemId as string | undefined,
    mergedIntoLocalItemId: raw.mergedIntoLocalItemId as string | undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function storageChestReadError(raw: unknown, catalog: Catalog): string | null {
  try {
    readStorageChest(raw, catalog);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "A chest record is invalid.";
  }
}

export function localStorageItemReadError(raw: unknown): string | null {
  try {
    readLocalStorageItem(raw);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "A local item record is invalid.";
  }
}
