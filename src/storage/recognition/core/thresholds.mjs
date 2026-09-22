// Automatic-acceptance thresholds derived by scripts/benchmark-storage-unknown-item.mjs's
// leave-one-out simulation (see that script's header comment for the method and its stated
// limitation: drawn from the same six screenshots as the known-item benchmark, not an independent
// unknown-item dataset). Re-run that script and update this file if the matcher, reference set, or
// benchmark dataset changes — do not hand-tune these numbers.
//
// Measured on this dataset: 0/30 simulated-unknown cases falsely accepted (declared target: <=5%);
// 22/30 (73.3%) genuine known items automatically accepted, all 22 correctly. The remaining known
// items stay "unresolved" for manual review rather than risk a wrong automatic match — per the
// master prompt, an unresolved result is acceptable, a confidently wrong one is not.
//
// A `matched` outcome using these thresholds is still a *reviewable proposal*: src/storage/
// ScanReview.tsx never skips the review step, it only changes which action is pre-selected.

export const DEFAULT_CONFIDENCE_THRESHOLDS = Object.freeze({
  minimumScore: 89.15,
  minimumMargin: 34.13,
});
