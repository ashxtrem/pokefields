// Slot crop-rect math, extracted verbatim from
// scripts/benchmark-native-storage-recognition.mjs's `slotBounds`. `slot` is 1-based, filled
// row-major (left-to-right, top-to-bottom) per `grid.columns`.

export function slotBounds(grid, slot) {
  const row = Math.floor((slot - 1) / grid.columns);
  const column = (slot - 1) % grid.columns;
  return {
    left: Math.round(grid.firstCenterX + column * grid.stepX - grid.cropWidth / 2),
    top: Math.round(grid.firstCenterY + row * grid.stepY - grid.cropHeight / 2),
    width: grid.cropWidth,
    height: grid.cropHeight,
  };
}
