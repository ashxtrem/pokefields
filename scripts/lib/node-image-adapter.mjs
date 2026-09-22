// Node-only pixel decoding for the shared recognition core (src/storage/recognition/core/*.mjs).
// Uses `sharp` to turn PNG/JPEG files into raw pixel buffers; the actual descriptor/ORB math is
// all in core/* so this stays a thin adapter, not a second copy of the algorithm. Used by both
// scripts/benchmark-native-storage-recognition.mjs and scripts/build-storage-references.mjs.

import sharp from "sharp";
import { ORB_SIDE, REFERENCE_ORB_PREP } from "../../src/storage/recognition/core/constants.mjs";
import { referenceDescriptorFromRgba } from "../../src/storage/recognition/core/foreground.mjs";
import { makeOrbDescriptor } from "../../src/storage/recognition/core/orb.mjs";

export async function extractSlotRgb(imagePath, bounds) {
  const { data, info } = await sharp(imagePath)
    .extract(bounds)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { pixels: data, width: info.width, height: info.height };
}

export async function referenceDescriptor(imagePath) {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return referenceDescriptorFromRgba(data, info.width, info.height);
}

export async function targetOrbDescriptor(cv, imagePath, bounds) {
  const { data, info } = await sharp(imagePath)
    .extract(bounds)
    .resize(ORB_SIDE, ORB_SIDE)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return makeOrbDescriptor(
    cv,
    cv.matFromArray(info.height, info.width, cv.CV_8UC1, Uint8Array.from(data)),
  );
}

export async function referenceOrbDescriptor(cv, imagePath) {
  const { data, info } = await sharp(imagePath)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(REFERENCE_ORB_PREP.resize, REFERENCE_ORB_PREP.resize, {
      fit: "contain",
      background: REFERENCE_ORB_PREP.background,
    })
    .extend({
      top: REFERENCE_ORB_PREP.pad,
      bottom: REFERENCE_ORB_PREP.pad,
      left: REFERENCE_ORB_PREP.pad,
      right: REFERENCE_ORB_PREP.pad,
      background: REFERENCE_ORB_PREP.background,
    })
    .flatten({ background: REFERENCE_ORB_PREP.background })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return makeOrbDescriptor(
    cv,
    cv.matFromArray(info.height, info.width, cv.CV_8UC1, Uint8Array.from(data)),
  );
}
