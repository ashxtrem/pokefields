import { NATIVE_GRID } from "./core/constants.mjs";

export type ImageShapeCheck =
  | { supported: true }
  | { supported: false; reason: string };

/**
 * The only automatically-recognized input in this release: an exact 1920x1080 native Switch
 * screenshot. Anything else (a resized screenshot, a camera photo, a cropped capture) is detected
 * here and routed to manual crop/assignment instead of the matcher — the master prompt is explicit
 * that the native-screenshot benchmark result must not be claimed for other inputs.
 */
export function checkNativeScreenshotShape(width: number, height: number): ImageShapeCheck {
  if (width === NATIVE_GRID.width && height === NATIVE_GRID.height) return { supported: true };
  return {
    supported: false,
    reason: `This image is ${width}x${height}. Automatic recognition supports exact ${NATIVE_GRID.width}x${NATIVE_GRID.height} native Switch screenshots — you can still continue with manual crop and assignment.`,
  };
}

/**
 * Decodes a File/Blob to an ImageBitmap. `imageOrientation: "from-image"` applies embedded EXIF
 * orientation automatically (camera photos) — a full manual EXIF parser is not implemented since
 * the browser already does this correctly for the formats phones actually produce.
 */
export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image could not be read. It may be corrupt or an unsupported format.");
  }
}

export async function sha256Hex(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
