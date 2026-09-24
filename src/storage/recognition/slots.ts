import { NATIVE_GRID, ORB_SIDE } from "./core/constants.mjs";
import { slotBounds, type CropRect } from "./core/grid.mjs";
import { buildMedianBackground, targetDescriptor } from "./core/foreground.mjs";
import type { Descriptor } from "./core/descriptor.mjs";

export interface SlotPixels {
  slot: number;
  bounds: CropRect;
  pixels: Uint8ClampedArray;
}

function drawSlot(bitmap: ImageBitmap, bounds: CropRect, outSize?: number): ImageData {
  const width = outSize ?? bounds.width;
  const height = outSize ?? bounds.height;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bitmap, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/** Extracts every slot (1..columns*rows) of the fixed 2x10 native grid from a decoded page image. */
export function extractAllSlotPixels(bitmap: ImageBitmap): SlotPixels[] {
  const total = NATIVE_GRID.columns * NATIVE_GRID.rows;
  const results: SlotPixels[] = [];
  for (let slot = 1; slot <= total; slot += 1) {
    const bounds = slotBounds(NATIVE_GRID, slot);
    const { data } = drawSlot(bitmap, bounds);
    results.push({ slot, bounds, pixels: data });
  }
  return results;
}

/**
 * Background is estimated from every slot crop across every page in this scan session (occupied
 * or empty) rather than only from slots already known to hold an item — unlike the benchmark,
 * production scans don't get an "occupied slot count" up front. See
 * docs/storage-locator-feature-master-prompt.md's image-preparation steps: across dozens of
 * differently-shaped item icons, the per-pixel median still converges on the constant shared panel
 * texture, so this doesn't need occupancy known in advance.
 */
export function buildScanBackground(allPagePixels: SlotPixels[][]): Uint8ClampedArray {
  const buffers = allPagePixels.flat().map((entry) => entry.pixels);
  return buildMedianBackground(buffers, NATIVE_GRID.cropWidth, NATIVE_GRID.cropHeight, 4);
}

export interface ClassifiedSlot {
  slot: number;
  bounds: CropRect;
  occupied: boolean;
  descriptor: Descriptor | null;
}

/** A null descriptor (no qualifying foreground against the shared background) means an empty slot. */
export function classifySlot(entry: SlotPixels, background: Uint8ClampedArray): ClassifiedSlot {
  const descriptor = targetDescriptor(entry.pixels, background, entry.bounds.width, entry.bounds.height, 4);
  return { slot: entry.slot, bounds: entry.bounds, occupied: descriptor !== null, descriptor };
}

/** Small compressed crop of one slot, kept for review (and persisted for any unresolved slot). */
export function cropThumbnailBlob(bitmap: ImageBitmap, bounds: CropRect): Promise<Blob> {
  const canvas = new OffscreenCanvas(bounds.width, bounds.height);
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bitmap, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
  return canvas.convertToBlob({ type: "image/webp", quality: 0.85 });
}

/**
 * Greyscale coefficients match sharp's default (Rec.709: 0.2126/0.7152/0.0722) as closely as a
 * canvas-based decode can — the only platform difference from the Node benchmark/build path,
 * which uses sharp's own greyscale conversion. Not covered by the pinned native-screenshot
 * benchmark (that runs entirely in Node); flagged as a known small cross-platform difference.
 *
 * Deliberately has no `cv` dependency — this runs on the main thread (see scanPrepare.ts) so the
 * recognition worker pool only ever has to do CV-dependent work. The resulting bytes are handed to
 * a pool worker, which turns them into an ORB descriptor via `cv.matFromArray` + `makeOrbDescriptor`
 * (see core/orb.mjs) — same math as before, just relocated across the main-thread/worker boundary.
 */
export function greyscaleSlotForOrb(bitmap: ImageBitmap, bounds: CropRect): Uint8Array {
  const { data } = drawSlot(bitmap, bounds, ORB_SIDE);
  const grey = new Uint8Array(ORB_SIDE * ORB_SIDE);
  for (let pixel = 0; pixel < grey.length; pixel += 1) {
    grey[pixel] = Math.round(
      0.2126 * data[pixel * 4] + 0.7152 * data[pixel * 4 + 1] + 0.0722 * data[pixel * 4 + 2],
    );
  }
  return grey;
}
