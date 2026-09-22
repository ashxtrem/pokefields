export type ChestType = "storage-box" | "big-storage-box";

export type StorageItemRef =
  | { kind: "catalog"; itemId: string }
  | { kind: "local"; localItemId: string };

export function sameItemRef(a: StorageItemRef, b: StorageItemRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "catalog") return a.itemId === (b as { itemId: string }).itemId;
  return a.localItemId === (b as { localItemId: string }).localItemId;
}

export function itemRefKey(ref: StorageItemRef): string {
  return ref.kind === "catalog" ? `catalog:${ref.itemId}` : `local:${ref.localItemId}`;
}

export interface UnresolvedSlot {
  id: string;
  imageId: string;
  page: number;
  slot: number;
}

export type ScanKind = "manual" | "partial" | "complete";

export const STORAGE_CHEST_VERSION = 1 as const;

export interface StorageChest {
  version: 1;
  id: string;
  name: string;
  regionId: string;
  type: ChestType;
  locationNote?: string;
  locationImageId?: string;
  /** Normalized 0..1 marker on the location image, optional per the master prompt. */
  locationMarker?: { x: number; y: number };
  itemRefs: StorageItemRef[];
  unresolvedSlots?: UnresolvedSlot[];
  createdAt: string;
  updatedAt: string;
  lastCompleteScanAt?: string;
  lastScanKind?: ScanKind;
  catalogVersion: string;
}

export const LOCAL_STORAGE_ITEM_VERSION = 1 as const;

export interface LocalStorageItem {
  version: 1;
  id: string;
  name: string;
  normalizedName: string;
  aliases: string[];
  note?: string;
  thumbnailImageId?: string;
  linkedCatalogItemId?: string;
  /**
   * Beyond the master prompt's example schema: set when this local item was merged into another
   * local item. Keeps a traceable pointer so undo can restore the pre-merge reference graph and a
   * merged-away item doesn't silently vanish from history (see the plan's architecture notes).
   */
  mergedIntoLocalItemId?: string;
  createdAt: string;
  updatedAt: string;
}

export type StorageImageKind = "location" | "local-item" | "unresolved-slot";

export interface StorageImage {
  id: string;
  kind: StorageImageKind;
  ownerId: string;
  mimeType: "image/webp" | "image/jpeg" | "image/png";
  width: number;
  height: number;
  byteLength: number;
  blob: Blob;
  createdAt: string;
}

/** Re-exported from the shared recognition core's confidence policy so the app has one definition. */
export type RecognitionOutcome =
  | {
      status: "matched";
      itemId: string;
      score: number;
      margin: number;
      source: "visual" | "ocr" | "combined";
    }
  | {
      status: "unresolved";
      candidates: Array<{ itemId: string; score: number }>;
      reason: "low-score" | "ambiguous" | "missing-reference" | "poor-image" | "no-item";
    };

export function makeLocalItemId(): string {
  return `local:${crypto.randomUUID()}`;
}

export function makeChestId(): string {
  return `chest:${crypto.randomUUID()}`;
}

export function makeImageId(): string {
  return `image:${crypto.randomUUID()}`;
}

export function normalizeItemName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function emptyChest(fields: {
  id: string;
  name: string;
  regionId: string;
  type: ChestType;
  catalogVersion: string;
  locationNote?: string;
  locationImageId?: string;
}): StorageChest {
  const now = new Date().toISOString();
  return {
    version: STORAGE_CHEST_VERSION,
    id: fields.id,
    name: fields.name,
    regionId: fields.regionId,
    type: fields.type,
    locationNote: fields.locationNote,
    locationImageId: fields.locationImageId,
    itemRefs: [],
    createdAt: now,
    updatedAt: now,
    catalogVersion: fields.catalogVersion,
  };
}
