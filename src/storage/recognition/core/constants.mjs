// Pinned recognition constants, extracted verbatim from
// scripts/benchmark-native-storage-recognition.mjs so the benchmark, the reference-index build
// script, and the in-app recognition worker all run the exact same numbers.
//
// Do not change any value here without rerunning
// `npm run benchmark:storage-native` and recording the comparison, per
// docs/storage-locator-feature-master-prompt.md ("Recognition strategy").
//
// NATIVE_GRID, RETRIEVAL and GATE mirror
// benchmarks/storage-recognition/native-switch-manifest.json's `input.grid`, `retrieval` and
// `gate` blocks respectively — tests/storage-recognition.test.ts asserts they stay in sync so the
// two copies cannot silently drift apart.

export const NATIVE_GRID = Object.freeze({
  width: 1920,
  height: 1080,
  columns: 10,
  rows: 2,
  firstCenterX: 485,
  firstCenterY: 242,
  stepX: 106,
  stepY: 105,
  cropWidth: 92,
  cropHeight: 92,
});

export const RETRIEVAL = Object.freeze({
  histogramCandidates: 100,
  orbCandidates: 400,
  histogramWeight: 20,
});

export const GATE = Object.freeze({
  minimumLabeledSlots: 30,
  minimumTop1Rate: 0.9,
  minimumTop3Rate: 0.98,
});

export const DESCRIPTOR_SIDE = 32;
export const ORB_SIDE = 256;

export const LSH_BYTES = [
  [0, 1],
  [8, 9],
  [16, 17],
  [24, 25],
  [4, 12],
  [20, 28],
  [2, 18],
  [10, 26],
];
export const LSH_BUCKET_SIZE = 4096;

export const FOREGROUND_DIFF_THRESHOLD = 35;
/** Foreground scan window: y in [1, FOREGROUND_SCAN_MAX_Y), x in [margin, width - margin). */
export const FOREGROUND_SCAN_MAX_Y = 77;
export const FOREGROUND_SCAN_MARGIN_X = 4;
export const FOREGROUND_MIN_COMPONENT_SIZE = 5;
export const FOREGROUND_CENTER_Y_BIAS = 36;
export const FOREGROUND_CENTRALITY_FALLOFF = 0.015;

export const DESCRIPTOR_WEIGHTS = Object.freeze({
  histogram: 0.5,
  shape: 0.3,
  aspect: 0.2,
});

/** Alpha <= this value counts as background/transparent when reading catalog artwork. */
export const REFERENCE_ALPHA_THRESHOLD = 50;

export const ORB_LOWE_RATIO = 0.78;
export const ORB_MAX_HAMMING_DISTANCE = 128;

export const REFERENCE_ORB_PREP = Object.freeze({
  resize: 220,
  pad: 18,
  background: "#f5f5f5",
});

/** ORB constructor args, in cv.ORB(...) order. cv is passed in for its ORB_HARRIS_SCORE enum. */
export function orbConstructorArgs(cv) {
  return [1000, 1.2, 8, 31, 0, 2, cv.ORB_HARRIS_SCORE, 31, 10];
}
