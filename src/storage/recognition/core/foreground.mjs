// Background-subtraction / connected-components foreground isolation, extracted verbatim from
// scripts/benchmark-native-storage-recognition.mjs's `targetDescriptor` and `referenceDescriptor`.
//
// Behavior-preserving change: the original `targetDescriptor` threw when a slot had no
// qualifying foreground component (every benchmark-labeled slot is known to hold an item, so
// that was a legitimate hard failure there). `isolateForeground` instead returns `null` for that
// case so the application can treat it as an *empty slot* rather than an error — see
// src/storage/recognition/slots.ts. Callers that need the benchmark's original "this must be an
// item" behavior (the benchmark script itself) should throw when `isolateForeground` returns null.

import { describe } from "./descriptor.mjs";
import {
  FOREGROUND_CENTER_Y_BIAS,
  FOREGROUND_CENTRALITY_FALLOFF,
  FOREGROUND_DIFF_THRESHOLD,
  FOREGROUND_MIN_COMPONENT_SIZE,
  FOREGROUND_SCAN_MARGIN_X,
  FOREGROUND_SCAN_MAX_Y,
  REFERENCE_ALPHA_THRESHOLD,
} from "./constants.mjs";

/**
 * Isolates the single dominant foreground object in a slot crop by diffing against a shared
 * background image, then 8-connected-component labeling the resulting diff mask and keeping the
 * most central/largest component. Returns null when no qualifying component exists (empty slot).
 */
export function isolateForeground(rgb, width, height, background, channels = 3) {
  const mask = new Uint8Array(width * height);
  const seen = new Uint8Array(width * height);
  const components = [];
  for (let y = 1; y < Math.min(height, FOREGROUND_SCAN_MAX_Y); y += 1) {
    for (let x = FOREGROUND_SCAN_MARGIN_X; x < width - FOREGROUND_SCAN_MARGIN_X; x += 1) {
      const pixel = y * width + x;
      const difference = Math.hypot(
        rgb[pixel * channels] - background[pixel * channels],
        rgb[pixel * channels + 1] - background[pixel * channels + 1],
        rgb[pixel * channels + 2] - background[pixel * channels + 2],
      );
      if (difference > FOREGROUND_DIFF_THRESHOLD) mask[pixel] = 1;
    }
  }

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start];
    const pixels = [];
    seen[start] = 1;
    let head = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;
    while (head < queue.length) {
      const pixel = queue[head++];
      const y = Math.floor(pixel / width);
      const x = pixel - y * width;
      pixels.push(pixel);
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (
        let neighborY = Math.max(0, y - 1);
        neighborY <= Math.min(height - 1, y + 1);
        neighborY += 1
      ) {
        for (
          let neighborX = Math.max(0, x - 1);
          neighborX <= Math.min(width - 1, x + 1);
          neighborX += 1
        ) {
          const neighbor = neighborY * width + neighborX;
          if (mask[neighbor] && !seen[neighbor]) {
            seen[neighbor] = 1;
            queue.push(neighbor);
          }
        }
      }
    }
    if (pixels.length > FOREGROUND_MIN_COMPONENT_SIZE) {
      components.push({
        pixels,
        size: pixels.length,
        minX,
        minY,
        maxX,
        maxY,
        centerX: sumX / pixels.length,
        centerY: sumY / pixels.length,
      });
    }
  }

  components.sort((left, right) => {
    const weightedSize = (component) =>
      component.size /
      (1 +
        FOREGROUND_CENTRALITY_FALLOFF *
          ((component.centerX - width / 2) ** 2 +
            (component.centerY - FOREGROUND_CENTER_Y_BIAS) ** 2));
    return weightedSize(right) - weightedSize(left);
  });
  const component = components[0];
  if (!component) return null;

  const filledMask = new Uint8Array(width * height);
  for (const pixel of component.pixels) filledMask[pixel] = 1;
  for (let y = component.minY; y <= component.maxY; y += 1) {
    let left = width;
    let right = -1;
    for (let x = component.minX; x <= component.maxX; x += 1) {
      if (filledMask[y * width + x]) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    if (right >= left) {
      for (let x = left; x <= right; x += 1) filledMask[y * width + x] = 1;
    }
  }
  return { component, filledMask };
}

/** Null return means the slot is empty (no foreground object against the shared background). */
export function targetDescriptor(rgb, background, width, height, channels = 3) {
  const isolated = isolateForeground(rgb, width, height, background, channels);
  if (!isolated) return null;
  return describe(rgb, width, height, isolated.filledMask, isolated.component, channels);
}

/**
 * Builds a descriptor for a catalog reference image from a decoded RGBA buffer, using the alpha
 * channel as the mask instead of background subtraction. Shared between Node (sharp's
 * `.ensureAlpha().raw()`) and the browser (canvas `ImageData.data`) since both produce
 * interleaved 8-bit RGBA.
 */
export function referenceDescriptorFromRgba(
  rgba,
  width,
  height,
  alphaThreshold = REFERENCE_ALPHA_THRESHOLD,
) {
  const mask = new Uint8Array(width * height);
  const bounds = { minX: width, minY: height, maxX: 0, maxY: 0 };
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (rgba[pixel * 4 + 3] <= alphaThreshold) continue;
    mask[pixel] = 1;
    const y = Math.floor(pixel / width);
    const x = pixel - y * width;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
  }
  return describe(rgba, width, height, mask, bounds, 4);
}

/**
 * Per-pixel median across every slot crop supplied (occupied or empty — see
 * docs/storage-locator-feature-master-prompt.md's background-estimation note in
 * src/storage/recognition/slots.ts for why using every slot in a scan is deliberate). Mirrors the
 * background-building loop inlined in the benchmark's `main()`.
 */
export function buildMedianBackground(pixelBuffers, width, height, channels = 3) {
  const background = new Uint8ClampedArray(width * height * channels);
  for (let index = 0; index < background.length; index += 1) {
    const values = pixelBuffers
      .map((pixels) => pixels[index])
      .sort((left, right) => left - right);
    background[index] = values[Math.floor(values.length / 2)];
  }
  return background;
}
