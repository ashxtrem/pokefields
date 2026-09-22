export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Descriptor {
  histogram: Float32Array;
  shape: Uint8Array;
  aspect: number;
}

export function rgbToHsv(
  red: number,
  green: number,
  blue: number,
): [hue: number, saturation: number, value: number];

export function describe(
  rgb: ArrayLike<number>,
  width: number,
  height: number,
  mask: ArrayLike<number>,
  bounds: Bounds,
  channels?: number,
): Descriptor;

export function descriptorSimilarity(left: Descriptor, right: Descriptor): number;
