import type { Bounds, Descriptor } from "./descriptor";

export interface IsolatedForeground {
  component: Bounds & { size: number; centerX: number; centerY: number; pixels: number[] };
  filledMask: Uint8Array;
}

export function isolateForeground(
  rgb: ArrayLike<number>,
  width: number,
  height: number,
  background: ArrayLike<number>,
  channels?: number,
): IsolatedForeground | null;

export function targetDescriptor(
  rgb: ArrayLike<number>,
  background: ArrayLike<number>,
  width: number,
  height: number,
  channels?: number,
): Descriptor | null;

export function referenceDescriptorFromRgba(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  alphaThreshold?: number,
): Descriptor;

export function buildMedianBackground(
  pixelBuffers: ArrayLike<number>[],
  width: number,
  height: number,
  channels?: number,
): Uint8ClampedArray;
