// Color/shape descriptor math, extracted verbatim from
// scripts/benchmark-native-storage-recognition.mjs (rgbToHsv, describe, descriptorSimilarity).
//
// `channels` generalizes the original hardcoded 3-channel (RGB) stride so the same function can
// read directly from a 4-channel RGBA buffer (e.g. a browser canvas ImageData) without a copy.
// Passing channels=3 reproduces the original benchmark behavior exactly.

import { DESCRIPTOR_SIDE, DESCRIPTOR_WEIGHTS } from "./constants.mjs";

export function rgbToHsv(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue /= 6;
    if (hue < 0) hue += 1;
  }
  return [hue, max ? delta / max : 0, max];
}

export function describe(rgb, width, height, mask, bounds, channels = 3) {
  const histogram = new Float32Array(12 * 4 * 4);
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const pixel = y * width + x;
      if (!mask[pixel]) continue;
      const [hue, saturation, value] = rgbToHsv(
        rgb[pixel * channels],
        rgb[pixel * channels + 1],
        rgb[pixel * channels + 2],
      );
      const index =
        (Math.min(11, Math.floor(hue * 12)) * 4 +
          Math.min(3, Math.floor(saturation * 4))) *
          4 +
        Math.min(3, Math.floor(value * 4));
      histogram[index] += 1;
    }
  }
  let norm = 0;
  for (const value of histogram) norm += value * value;
  norm = Math.sqrt(norm) || 1;
  for (let index = 0; index < histogram.length; index += 1)
    histogram[index] /= norm;

  const shape = new Uint8Array(DESCRIPTOR_SIDE * DESCRIPTOR_SIDE);
  const boundsWidth = bounds.maxX - bounds.minX + 1;
  const boundsHeight = bounds.maxY - bounds.minY + 1;
  for (let y = 0; y < DESCRIPTOR_SIDE; y += 1) {
    for (let x = 0; x < DESCRIPTOR_SIDE; x += 1) {
      const sourceX = Math.min(
        bounds.maxX,
        Math.floor(bounds.minX + ((x + 0.5) * boundsWidth) / DESCRIPTOR_SIDE),
      );
      const sourceY = Math.min(
        bounds.maxY,
        Math.floor(bounds.minY + ((y + 0.5) * boundsHeight) / DESCRIPTOR_SIDE),
      );
      shape[y * DESCRIPTOR_SIDE + x] = mask[sourceY * width + sourceX] ? 1 : 0;
    }
  }
  return {
    histogram,
    shape,
    aspect: boundsWidth / boundsHeight,
  };
}

export function descriptorSimilarity(left, right) {
  let histogram = 0;
  for (let index = 0; index < left.histogram.length; index += 1)
    histogram += left.histogram[index] * right.histogram[index];
  let intersection = 0;
  let leftArea = 0;
  let rightArea = 0;
  for (let index = 0; index < left.shape.length; index += 1) {
    leftArea += left.shape[index];
    rightArea += right.shape[index];
    if (left.shape[index] && right.shape[index]) intersection += 1;
  }
  const dice = (2 * intersection) / (leftArea + rightArea || 1);
  const aspect = Math.exp(-Math.abs(Math.log(left.aspect / right.aspect)));
  return (
    DESCRIPTOR_WEIGHTS.histogram * histogram +
    DESCRIPTOR_WEIGHTS.shape * dice +
    DESCRIPTOR_WEIGHTS.aspect * aspect
  );
}
