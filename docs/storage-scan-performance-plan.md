# Storage screenshot scan — performance plan

## Context

Importing a screenshot into a Storage chest feels slow, especially for a full Big storage box (60 slots, 3 pages). This plan is based on reading the actual recognition pipeline end to end (`src/storage/recognition/worker.ts`, `matcher.ts`, `slots.ts`, `core/retrieval.mjs`, `core/orb.mjs`, `core/lsh.mjs`, `referenceIndex.ts`, `ScanFlow.tsx`), not just the earlier RCA's description — one of that RCA's claims turned out to be slightly wrong (see below), so treat this as the verified version.

## Verified root causes, ranked by actual cost

**1. The reference-index "warm-up" cost repeats on every single "Import screenshot" click — this is the biggest easy win.**

[ChestDetail.tsx:263](src/storage/ChestDetail.tsx:263) mounts `<ScanFlow>` only while `scanning` is true, and unmounts it (`onClose`) after every scan. `ScanFlow`'s `workerRef` is a plain `useRef(null)` ([ScanFlow.tsx:33](src/storage/ScanFlow.tsx:33)), so it starts `null` on every mount — meaning **every time the dialog opens, a brand-new `Worker` is spawned** ([ScanFlow.tsx:89-90](src/storage/ScanFlow.tsx:89)), which re-fetches all 3 reference-index parts (~43 MiB total), re-parses the JSON, re-decodes every base64 blob, and reconstructs ~1,765 `cv.Mat` objects from scratch ([referenceIndex.ts:59-83](src/storage/recognition/referenceIndex.ts:59)). This happens even for a *second* scan in the same visit — e.g. scanning page 1, going "Back to pages," then scanning page 2 pays the full warm-up cost again.

Compounding this: "Cancel scan" calls `worker.terminate()` and sets `workerRef.current = null` ([ScanFlow.tsx:121-122](src/storage/ScanFlow.tsx:121)) instead of using the soft-cancel protocol the worker already supports (`{type: "cancel", scanId}`, which the worker already handles via `cancelledScanIds` — [worker.ts:46-49](src/storage/recognition/worker.ts:46)). So canceling a scan also throws away the warm worker for no reason.

**2. Per occupied slot, matching runs brute-force ORB comparisons against up to ~400-500 candidates — this is the dominant per-slot cost.**

For every occupied slot, `rankCandidates` ([core/retrieval.mjs:22](src/storage/recognition/core/retrieval.mjs:22)):
- Scores histogram similarity against all 1,765 references, sorts, keeps the top 100.
- LSH-votes against all references, sorts, keeps the top 400 ORB candidates.
- For the **union** of those (up to ~400-500 unique candidates), calls `matchOrb` ([core/orb.mjs:21](src/storage/recognition/core/orb.mjs:21)) — a real brute-force k-NN Hamming match between the target's and that reference's ORB descriptors (each up to 1000 keypoints).

The histogram-scoring and LSH-voting passes are cheap (plain typed-array arithmetic over 1,765 items — sub-millisecond). The **`matchOrb` calls are the real cost**: up to 500 of them per occupied slot, each doing real keypoint matching. For a full 60-slot Big storage box, that's potentially ~30,000 sequential ORB matches in one scan.

Making this worse: `matchOrb` constructs a **new `cv.BFMatcher` instance on every single call** ([core/orb.mjs:24](src/storage/recognition/core/orb.mjs:24)) instead of reusing one — pure WASM object-allocation overhead on top of the actual matching work, for every one of those ~30,000 calls.

**3. Everything above runs strictly sequentially: one page at a time, one slot at a time, one candidate at a time.** [worker.ts:61](src/storage/recognition/worker.ts:61) loops pages with a plain `for`; [matcher.ts:44](src/storage/recognition/matcher.ts:44) loops slots the same way. OpenCV.js here is single-threaded WASM (no pthreads/SharedArrayBuffer build), so nothing in this pipeline currently runs on more than one CPU core at once — on a multi-core phone or laptop, most of the device sits idle during a scan.

**Correction to the earlier RCA:** it described the worker cropping every slot twice as "redundant image processing." That's not quite right — [slots.ts](src/storage/recognition/slots.ts) crops each slot once at 92×92 for background estimation and descriptor matching (reused, not redundant), and separately crops occupied slots at 256×256 specifically for ORB feature detection ([matcher.ts:74](src/storage/recognition/matcher.ts:74)), because ORB needs a different resolution than the color/shape descriptor. Two crops happen, but they're not duplicate work — they serve two different algorithms. Not a real inefficiency to chase.

**4. Device and network do matter, but as multipliers, not the root cause.** OpenCV WASM matching speed and the initial 43 MiB fetch both scale with device/network speed — but even on a fast device, the sequential ~30,000-call structure above means there's a real floor on scan time that better hardware only shrinks, doesn't remove.

## Proposed fixes

### P0 — safe, no accuracy risk, no benchmark re-run needed

These don't change which candidates are compared or how they're scored — same output, just less wasted work.

1. **Persist the worker (and its warmed-up reference index) across scans within a page session**, instead of recreating it per `ScanFlow` mount. Move `workerRef`'s lifetime up to something that outlives the modal — e.g. a module-level singleton in the recognition layer, or a small context/hook one level up (`StorageContext` or a new `useRecognitionWorker()`) — so the ~43 MiB load + Mat-construction cost is paid once per app session (until page reload), not once per "Import screenshot" click.
2. **Make "Cancel scan" a soft cancel** (send `{type: "cancel", scanId}`, which the worker already supports) instead of `worker.terminate()`, so canceling doesn't also discard the warm index. Only actually terminate the worker on real teardown (e.g. app unmount), if ever.
3. **Reuse one `cv.BFMatcher` per scan** instead of constructing/deleting one per candidate inside `matchOrb`'s hot path — pure allocation-overhead removal; `BFMatcher.knnMatch` already takes query/train descriptors per call, so one shared instance is safe and behaves identically.

Expected impact: (1)+(2) should make the *second and later* scan in a visit dramatically faster (no more full warm-up tax), which is probably most of what's actually being felt if you're scanning multiple pages of a Big storage box or rescanning after a mistake. (3) is a smaller, safe cleanup on top.

### P1 — bigger lever, more implementation surface, still no accuracy risk

4. **Parallelize per-slot matching across a small worker pool.** Once the shared background is computed (needs all pages first, cheap), every occupied slot's matching is fully independent of every other slot's. A pool of 2-4 workers (sized conservatively for phone memory — each worker needs its own OpenCV WASM instance and its own set of ~1,765 `cv.Mat` objects, so memory scales with pool size) could cut wall-clock time roughly in proportion to pool size for a fully-occupied Big storage box.
   - The reference-index *fetch* only needs to happen once (browser HTTP cache serves the rest), but each worker still pays its own CPU cost to base64-decode and build ~1,765 `cv.Mat`s, since `cv.Mat` objects live in one WASM instance's memory and can't be shared across workers.
   - This is real new coordination code: a pool manager, work distribution across slots, per-worker cancellation, and result aggregation preserving page/slot order. Worth doing, but it's a bigger, riskier change than the P0 items — I'd want to measure P0's impact first before deciding how much of this is still needed.

### P2 — attempted, reverted: fails the benchmark gate at every level tried

5. **Reduce `RETRIEVAL.orbCandidates`** (was 400 — see `core/constants.mjs`). Tried both `orbCandidates: 200` and `orbCandidates: 300` (with `histogramCandidates` left at 100), re-running `npm run benchmark:storage-native` after each per the master prompt's rule on this pinned, benchmark-gated data:

   | orbCandidates | top-1 | top-3 | verdict |
   |---|---|---|---|
   | 400 (baseline) | 96.67% | 100% | PASS |
   | 300 | 93.33% | 96.67% | **NO-GO** (top-3 below the 98% gate) |
   | 200 | 93.33% | 96.67% | **NO-GO** (identical failure) |

   Both reduced values fail identically, on the same single item: `159485.jpg` slot 3 (`silverfeather`) goes from correctly ranking #1 at 400 candidates to "ranked outside shortlist" at both 300 and 200. That item's true match apparently doesn't collect enough LSH votes to stay in the ORB-candidate shortlist once it shrinks at all — this isn't a gradual accuracy/speed tradeoff with a tunable sweet spot, it's a hard cliff for at least this one catalog item, and probably others with similarly low-vote reference images. Speed-wise the lever is real (the benchmark's own scoring pass went from ~238s at 400 to ~95-128s at 200-300), but not worth the accuracy regression it causes.

   **Reverted to `orbCandidates: 400`** (both `core/constants.mjs` and the manifest's mirrored copy) — confirmed back to a clean `git diff` (no net change) before committing anything else. Not pursuing further values between 300-400: even a value that happened to pass would only claw back a few percent of runtime for a fragile, catalog-specific margin that a future catalog update could just as easily break again. P0+P1 are the actual shipped speedup; P2 is closed as "tried, doesn't clear the gate," not left open for a future attempt at a different number.

## Android (Capacitor) compatibility

There's an in-progress Capacitor Android release (`docs/android-play-store-release-plan.md`) that packages this same React/Vite codebase into a WebView app, offline-only, sharing the exact recognition pipeline this plan touches. Checked each proposed fix against it directly rather than assuming:

- **P0 (persist worker, soft-cancel, reuse BFMatcher):** fully compatible, no Android-specific work needed. `capacitor.config.ts` sets `androidScheme: "https"`, so the app runs from a real `https://localhost` origin inside the WebView — Workers, `fetch`, and relative-URL resolution all behave exactly as on the deployed web app. If anything this matters more on Android, since lower-end devices feel the repeated ~43 MiB warm-up harder than a desktop.
- **The reference-index sharding shipped 2026-09-22:** already accounted for — `scripts/verify-android-assets.mjs` already reads the manifest and iterates `referenceManifest.parts`, so the Android asset pipeline already expects exactly this shape.
- **P1 (worker pool):** will run — Android WebView already runs one module Worker today for scanning/OCR — but needs its own sizing and its own verification, not the same pool size as web. Each worker needs a full OpenCV WASM instance plus its own ~1,765 reconstructed descriptor objects; multiplying that by 2-4 workers is a real OOM/ANR risk specifically on the low-end/mid-range, memory-constrained devices the Android plan's Phase 8 device matrix targets. That plan's own release checklist currently has "Screenshot recognition completes offline on a mid-range device" **unchecked** — an already-acknowledged open gap. Recommendation: gate pool size by distribution (`isAndroidDistribution()`), default it smaller (or off) on Android, and treat clearing that existing checklist item as the explicit condition for enabling pooling there.
- **P2 (candidate-count tuning):** platform-agnostic — same shared benchmark and math apply identically to both distributions, no extra Android-specific risk beyond the general re-benchmark requirement already noted above.

## What I'd want your call on

- **Order:** I'd suggest P0 first (low-risk, likely the single biggest felt improvement since it fixes the "every scan pays full warm-up" problem), then actually measure a real scan's timing before deciding whether P1's added complexity is still needed.
- **P1 worker-pool size:** a trade-off between speed and memory on lower-end/phone devices, since this app is regularly tested over LAN on real phones. I'd default conservative (2 workers) unless you want it more aggressive.
- **P2:** only worth opening at all if P0+P1 don't get scan time to a place you're happy with, since it's the only item here that risks match accuracy and needs the benchmark re-run.

## Verification plan

- P0 items 1-3 are pure refactors with identical output — `npm run test`/`npx tsc -b` should stay green with no new tests strictly required, though I'd add one for the soft-cancel behavior. Real-device verification: time a multi-page Big storage box scan before/after, and confirm a second scan in the same visit no longer pays the initial load delay.
- P1 needs manual timing on both a fast machine and a real phone (memory pressure is the actual risk, not correctness) before shipping.
- P2, if ever pursued, is gated on `npm run benchmark:storage-native` passing at the new candidate counts.
