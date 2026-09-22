import type { NativeGrid } from "./constants";

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function slotBounds(grid: NativeGrid, slot: number): CropRect;
