import {
  buildScanBackground,
  classifySlot,
  cropThumbnailBlob,
  extractAllSlotPixels,
  greyscaleSlotForOrb,
} from "./slots";
import type { CropRect } from "./core/grid.mjs";
import type { Descriptor } from "./core/descriptor.mjs";

export interface PreparedSlot {
  page: number;
  slot: number;
  bounds: CropRect;
  occupied: boolean;
  /** Present only when `occupied` — the pool worker builds an ORB descriptor from this. */
  grey: Uint8Array | null;
  descriptor: Descriptor | null;
  /** Present only when `occupied` — kept for the review UI and any unresolved-slot persistence. */
  thumbnail: Blob | null;
}

/**
 * Runs every non-OpenCV step of a scan on the main thread — cropping every slot once, estimating
 * the shared background, and classifying occupied vs. empty — so the recognition worker pool only
 * ever has to spend time on the CV-dependent ORB matching step for slots that actually hold
 * something. See docs/storage-scan-performance-plan.md.
 *
 * This also fixes a real (if minor) inefficiency the old single-worker pipeline had: it called
 * `extractAllSlotPixels` once here to build the shared background, then called it *again* per page
 * inside the old `recognizePage` to get the same slots' pixels for classification. This version
 * extracts each page's slots exactly once and reuses that result for both steps.
 *
 * Closes each page's bitmap once its slots are fully extracted.
 */
export async function prepareScanSlots(
  pages: Array<{ page: number; bitmap: ImageBitmap }>,
): Promise<PreparedSlot[]> {
  const allSlotPixels = pages.map((entry) => extractAllSlotPixels(entry.bitmap));
  const background = buildScanBackground(allSlotPixels);
  const prepared: PreparedSlot[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    const { page, bitmap } = pages[index]!;
    for (const entry of allSlotPixels[index]!) {
      const classified = classifySlot(entry, background);
      if (!classified.occupied || !classified.descriptor) {
        prepared.push({
          page,
          slot: entry.slot,
          bounds: classified.bounds,
          occupied: false,
          grey: null,
          descriptor: null,
          thumbnail: null,
        });
        continue;
      }
      const [thumbnail, grey] = await Promise.all([
        cropThumbnailBlob(bitmap, classified.bounds),
        Promise.resolve(greyscaleSlotForOrb(bitmap, classified.bounds)),
      ]);
      prepared.push({
        page,
        slot: entry.slot,
        bounds: classified.bounds,
        occupied: true,
        grey,
        descriptor: classified.descriptor,
        thumbnail,
      });
    }
    bitmap.close();
  }

  return prepared;
}
