// Confidence policy: turns ranked candidates into the RecognitionOutcome union from
// docs/storage-locator-feature-master-prompt.md ("Confidence outcomes"). Reused unchanged by
// scripts/benchmark-storage-unknown-item.mjs (which computes thresholds) and the app worker
// (which applies them) — no calibration numbers are hardcoded here.
//
// Per the master prompt: "Do not add an automatic-match threshold yet [until] a held-out
// unknown-item benchmark" derives one. Passing `thresholds: undefined` (or omitting it) makes
// every result `unresolved`, which is the correct default until that benchmark has run.

const MAX_CANDIDATES_SHOWN = 5;

export function classifyOutcome(ranked, thresholds) {
  if (!ranked.length) return { status: "unresolved", candidates: [], reason: "no-item" };

  const candidates = ranked
    .slice(0, MAX_CANDIDATES_SHOWN)
    .map((candidate) => ({ itemId: candidate.id, score: candidate.score }));

  if (!thresholds) return { status: "unresolved", candidates, reason: "low-score" };

  const top = ranked[0];
  const second = ranked[1];
  const margin = second ? top.score - second.score : top.score;

  if (top.score < thresholds.minimumScore)
    return { status: "unresolved", candidates, reason: "low-score" };
  if (margin < thresholds.minimumMargin)
    return { status: "unresolved", candidates, reason: "ambiguous" };

  return {
    status: "matched",
    itemId: top.id,
    score: top.score,
    margin,
    source: "visual",
  };
}
