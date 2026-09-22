import { validateBackup, type SaveState } from "../persistence/store";
import type { Catalog } from "../catalog/types";
import { replaceAllStorageData } from "./db";
import { readLocalStorageItem, readStorageChest } from "./migration";
import { MAX_COMPRESSED_IMAGE_BYTES } from "./constants";
import type { LocalStorageItem, StorageChest, StorageImage } from "./types";

/**
 * Backup envelope v2: `{ envelopeVersion: 2, state: SaveState, storage?: {...} }`. A legacy export
 * is a bare SaveState object (no `envelopeVersion` field) and is treated as v1 with no storage
 * data — see docs/storage-locator-feature-master-prompt.md's "Use a new backup-envelope version
 * rather than blindly changing the meaning of the existing SaveState schemaVersion."
 */

export const STORAGE_BACKUP_FEATURE_VERSION = 1;

export interface StorageBackupImage {
  id: string;
  kind: StorageImage["kind"];
  ownerId: string;
  mimeType: StorageImage["mimeType"];
  width: number;
  height: number;
  byteLength: number;
  dataUrl: string;
  createdAt: string;
}

export interface StorageBackupPayload {
  featureVersion: number;
  chests: unknown[];
  localItems: unknown[];
  images: StorageBackupImage[];
}

export interface BackupEnvelopeV2 {
  envelopeVersion: 2;
  state: SaveState;
  storage?: StorageBackupPayload;
}

export interface ParsedBackup {
  state: SaveState;
  storage: { chests: StorageChest[]; localItems: LocalStorageItem[]; images: StorageImage[] } | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}

// arrayBuffer()+manual base64 rather than FileReader.readAsDataURL: this runs identically in the
// browser app and in Node-based Vitest (which has no FileReader global).
async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!);
  const base64 =
    typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
  return `data:${blob.type || "application/octet-stream"};base64,${base64}`;
}

function dataUrlToBlob(dataUrl: string, mimeType: string): Blob {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) fail("Backup has an image with invalid data.");
  const binary = atob(dataUrl.slice(commaIndex + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

export async function buildBackupEnvelope(
  state: SaveState,
  chests: StorageChest[],
  localItems: LocalStorageItem[],
  images: StorageImage[],
): Promise<BackupEnvelopeV2> {
  const encodedImages: StorageBackupImage[] = await Promise.all(
    images.map(async (image) => ({
      id: image.id,
      kind: image.kind,
      ownerId: image.ownerId,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      byteLength: image.byteLength,
      dataUrl: await blobToDataUrl(image.blob),
      createdAt: image.createdAt,
    })),
  );
  return {
    envelopeVersion: 2,
    state,
    storage: {
      featureVersion: STORAGE_BACKUP_FEATURE_VERSION,
      chests,
      localItems,
      images: encodedImages,
    },
  };
}

function validateImageEntry(raw: unknown): StorageImage {
  if (!isObject(raw)) fail("Backup has an invalid image.");
  const { id, kind, ownerId, mimeType, width, height, byteLength, dataUrl, createdAt } = raw;
  if (typeof id !== "string" || !id) fail("Backup has an image with a missing id.");
  if (kind !== "location" && kind !== "local-item" && kind !== "unresolved-slot")
    fail("Backup has an image with an invalid kind.");
  if (typeof ownerId !== "string" || !ownerId) fail("Backup has an image with a missing owner.");
  if (mimeType !== "image/webp" && mimeType !== "image/jpeg" && mimeType !== "image/png")
    fail("Backup has an image with an unsupported type.");
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(byteLength))
    fail("Backup has an image with invalid dimensions.");
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:"))
    fail("Backup has an image with invalid data.");
  if (typeof createdAt !== "string" || !createdAt) fail("Backup has an image with a missing date.");
  const blob = dataUrlToBlob(dataUrl, mimeType);
  if (blob.size > MAX_COMPRESSED_IMAGE_BYTES * 2) fail("Backup has an image that is too large.");
  return {
    id,
    kind,
    ownerId,
    mimeType,
    width: width as number,
    height: height as number,
    byteLength: byteLength as number,
    blob,
    createdAt,
  };
}

function validateStoragePayload(
  raw: unknown,
  catalog: Catalog,
): { chests: StorageChest[]; localItems: LocalStorageItem[]; images: StorageImage[] } {
  if (!isObject(raw)) fail("Backup has invalid storage data.");
  if (typeof raw.featureVersion !== "number" || raw.featureVersion > STORAGE_BACKUP_FEATURE_VERSION)
    fail("Backup uses a newer Storage format than this app understands.");
  if (!Array.isArray(raw.chests) || !Array.isArray(raw.localItems) || !Array.isArray(raw.images))
    fail("Backup has invalid storage data.");

  const localItems = raw.localItems.map((entry) => readLocalStorageItem(entry));
  if (new Set(localItems.map((item) => item.id)).size !== localItems.length)
    fail("Backup has duplicate local item ids.");

  const chests = raw.chests.map((entry) => readStorageChest(entry, catalog));
  if (new Set(chests.map((chest) => chest.id)).size !== chests.length)
    fail("Backup has duplicate chest ids.");

  const images = raw.images.map((entry) => validateImageEntry(entry));
  const imageIds = new Set(images.map((image) => image.id));
  const localItemIds = new Set(localItems.map((item) => item.id));

  for (const chest of chests) {
    for (const ref of chest.itemRefs) {
      if (ref.kind === "local" && !localItemIds.has(ref.localItemId))
        fail(`Backup chest "${chest.name}" references a missing local item.`);
    }
    if (chest.locationImageId && !imageIds.has(chest.locationImageId))
      fail(`Backup chest "${chest.name}" is missing its location image.`);
    for (const slot of chest.unresolvedSlots ?? [])
      if (!imageIds.has(slot.imageId))
        fail(`Backup chest "${chest.name}" is missing an unresolved-slot image.`);
  }
  for (const item of localItems) {
    if (item.thumbnailImageId && !imageIds.has(item.thumbnailImageId))
      fail(`Backup local item "${item.name}" is missing its thumbnail image.`);
    if (item.linkedCatalogItemId && !catalog.items.some((c) => c.id === item.linkedCatalogItemId))
      fail(`Backup local item "${item.name}" links to an unknown catalog item.`);
  }

  return { chests, localItems, images };
}

/** Parses+validates fully before any write, whether the payload is a v2 envelope or a legacy v1 SaveState. */
export function validateBackupEnvelope(raw: unknown, catalog: Catalog): ParsedBackup {
  if (isObject(raw) && "envelopeVersion" in raw) {
    if (typeof raw.envelopeVersion !== "number") fail("Backup has an invalid envelope version.");
    if (raw.envelopeVersion > 2) fail("This backup uses a newer format than this app understands.");
    if (raw.envelopeVersion !== 2) fail("This backup's envelope version is not supported.");
    const state = validateBackup(raw.state, catalog);
    const storage = raw.storage !== undefined ? validateStoragePayload(raw.storage, catalog) : null;
    return { state, storage };
  }
  // Legacy export: a bare SaveState with no envelope and no Storage data.
  return { state: validateBackup(raw, catalog), storage: null };
}

/**
 * Applies a validated backup. Storage tables are only replaced when the backup actually carries a
 * `storage` section — a legacy import (no Storage data at all) must never wipe existing chests.
 * `state` is applied by the caller via the existing `replaceNotebook` (src/progress/context.tsx).
 */
export async function applyStorageBackup(parsed: ParsedBackup): Promise<void> {
  if (!parsed.storage) return;
  await replaceAllStorageData(parsed.storage.chests, parsed.storage.localItems, parsed.storage.images);
}
