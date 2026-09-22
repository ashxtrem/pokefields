import {
  LOCATION_IMAGE_MAX_EDGE,
  LOCATION_IMAGE_QUALITY,
  MAX_COMPRESSED_IMAGE_BYTES,
  THUMBNAIL_QUALITY,
  THUMBNAIL_SIZE,
} from "./constants";
import { allImageRows, deleteImageRow, putImage } from "./db";
import {
  makeImageId,
  type LocalStorageItem,
  type StorageChest,
  type StorageImage,
  type StorageImageKind,
} from "./types";

/**
 * Capture -> resize/encode -> store. No existing image-upload precedent exists in this repo (only
 * the whole-notebook JSON export/import Blob in src/App.tsx) — this is new code following the
 * master prompt's image budgets (src/storage/constants.ts).
 */

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToBlob(canvas: AnyCanvas, type: string, quality: number): Promise<Blob | null> {
  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, type, quality));
}

async function encodeCanvas(
  canvas: AnyCanvas,
  quality: number,
): Promise<{ blob: Blob; mimeType: StorageImage["mimeType"] }> {
  const webp = await canvasToBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") return { blob: webp, mimeType: "image/webp" };
  const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
  if (jpeg) return { blob: jpeg, mimeType: "image/jpeg" };
  throw new Error("This image could not be processed. Try a different photo.");
}

async function resizeToBlob(
  file: Blob,
  maxEdge: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number; mimeType: StorageImage["mimeType"] }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be read. It may be corrupt or an unsupported format.");
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error("This browser cannot process images right now.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const { blob, mimeType } = await encodeCanvas(canvas, quality);
  return { blob, width, height, mimeType };
}

async function storeResizedImage(
  file: Blob,
  ownerId: string,
  kind: StorageImageKind,
  maxEdge: number,
  quality: number,
): Promise<StorageImage> {
  const { blob, width, height, mimeType } = await resizeToBlob(file, maxEdge, quality);
  if (blob.size > MAX_COMPRESSED_IMAGE_BYTES)
    throw new Error("This image is still too large after compression. Try a smaller photo.");
  const image: StorageImage = {
    id: makeImageId(),
    kind,
    ownerId,
    mimeType,
    width,
    height,
    byteLength: blob.size,
    blob,
    createdAt: new Date().toISOString(),
  };
  await putImage(image);
  return image;
}

export function storeLocationImage(file: Blob, ownerId: string): Promise<StorageImage> {
  return storeResizedImage(file, ownerId, "location", LOCATION_IMAGE_MAX_EDGE, LOCATION_IMAGE_QUALITY);
}

export function storeThumbnailImage(
  file: Blob,
  ownerId: string,
  kind: "local-item" | "unresolved-slot",
): Promise<StorageImage> {
  return storeResizedImage(file, ownerId, kind, THUMBNAIL_SIZE, THUMBNAIL_QUALITY);
}

/** Stores an already-encoded image (e.g. a slot crop produced by the recognition worker) as-is. */
export async function storePreparedImage(
  blob: Blob,
  ownerId: string,
  kind: StorageImageKind,
  mimeType: StorageImage["mimeType"],
  width: number,
  height: number,
): Promise<StorageImage> {
  const image: StorageImage = {
    id: makeImageId(),
    kind,
    ownerId,
    mimeType,
    width,
    height,
    byteLength: blob.size,
    blob,
    createdAt: new Date().toISOString(),
  };
  await putImage(image);
  return image;
}

export function imageObjectUrl(image: StorageImage): string {
  return URL.createObjectURL(image.blob);
}

export function revokeImageObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/** Every image id currently referenced by a chest or local item — the GC keep-set. */
export function collectReferencedImageIds(
  chests: StorageChest[],
  localItems: LocalStorageItem[],
  protectedIds: Iterable<string> = [],
): Set<string> {
  const ids = new Set(protectedIds);
  for (const chest of chests) {
    if (chest.locationImageId) ids.add(chest.locationImageId);
    for (const slot of chest.unresolvedSlots ?? []) ids.add(slot.imageId);
  }
  for (const item of localItems) if (item.thumbnailImageId) ids.add(item.thumbnailImageId);
  return ids;
}

/**
 * Deletes every stored image not in `referencedIds` (which must already include any
 * undo-protected images — see src/storage/undo.ts). Returns the number removed.
 */
export async function garbageCollectImages(referencedIds: Set<string>): Promise<number> {
  const rows = await allImageRows();
  let deleted = 0;
  for (const row of rows) {
    if (!referencedIds.has(row.id)) {
      await deleteImageRow(row.id);
      deleted += 1;
    }
  }
  return deleted;
}
