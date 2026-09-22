# Master Prompt: Build the Local Storage Locator and Screenshot Item Recognition Feature

Use this prompt with an AI coding agent working in the Pokopia Fieldnotes repository.

## Role and objective

You are implementing a production-quality **Storage Locator** for Pokopia Fieldnotes.

The feature lets one player:

1. Create a record for each in-game storage chest.
2. Record the chest’s region, name, type, location note, and a screenshot showing where the chest is in the game.
3. Add chest contents manually or scan one or more native Switch screenshots of the open chest.
4. Recognize item icons locally against the bundled item catalog.
5. Review and correct every proposed result before saving.
6. Save catalog items and player-created local items in IndexedDB.
7. Search for an item and see every chest where it was last recorded.

Complete the feature end to end. Do not stop after creating a plan, data model, recognition spike, or isolated UI. Preserve unrelated work in the repository, inspect the current working tree before editing, and do not overwrite changes you did not create.

## Repository and product context

- Workspace: /Users/ashishtripathi/Documents/My Projetcs/pkm-companion
- Stack: React 19, TypeScript, Vite, Dexie/IndexedDB, Lucide icons, Vitest.
- Use Node 22. Older Node versions are known to fail this project’s test tooling.
- Product context is in PRODUCT.md.
- The app is a private, device-local Pokopia notebook. It has no account, server, or live game API.
- Current primary destinations are Pokédex, Habitats, Items, and Housemates.
- Current local database is named pokopia-fieldnotes.
- Current persistence code is in src/persistence/store.ts.
- Current global notebook state is stored in the state table under the main record.
- The current backup is JSON and is managed from src/App.tsx.
- Current routes and visit-scoped navigation memory are in src/ui/navigation.ts.
- Catalog item identity is the stable item id from public/data/catalog.json.
- Catalog item artwork is served from /images/items/<item-id>.png through itemImageUrl().
- The catalog currently contains 1,767 items; the completed benchmark found 1,765 usable baked item images. Missing reference artwork must be handled without crashing or inventing a match.
- Recognition feasibility has already been benchmarked. Read `docs/research/storage-recognition-benchmark.md`, `benchmarks/storage-recognition/native-switch-manifest.json`, and `scripts/benchmark-native-storage-recognition.mjs` before designing or changing the recognizer.
- The native Switch screenshot benchmark passed: 29/30 top-1 (96.7%) and 30/30 top-3 (100%) across all 1,765 usable catalog images.
- The benchmark covers 30 manually verified slots from 106 occupied slots across six unique screenshots representing two Big storage boxes. Four byte-identical screenshots were detected and excluded.
- The only top-1 miss was Tabletop mic, which ranked second behind Nugget.
- The same approach did not pass on the three handheld camera photos: 1/3 top-1 and 2/3 top-3. Do not claim automatic phone-camera recognition support.
- Unknown or newer-DLC item rejection has not been benchmarked. Until it is calibrated, recognition results are proposals that require player review.
- The benchmark took 196.7 seconds in Node on the development machine. Its accuracy is sufficient for an MVP, but its current runtime implementation is not suitable for the product UI.
- Reuse the existing visual system, responsive behavior, components, typography, and Fieldnotes voice. This is an Operate surface inside an established product, not a redesign.
- Remain an unofficial fan project. Do not imply affiliation with Nintendo, Game Freak, Creatures, or The Pokémon Company.

Before modifying code:

1. Read PRODUCT.md, package.json, src/App.tsx, src/ui/navigation.ts, src/persistence/store.ts, src/progress/context.tsx, src/catalog/types.ts, src/dex/glossary.ts, src/items/ItemDetail.tsx, relevant tests, and the current working-tree status.
2. Inspect the current app in the browser at desktop and mobile widths.
3. Locate any AGENTS.md or repository-specific instructions and follow them.
4. Preserve all unrelated tracked and untracked changes.

## Non-negotiable product decisions

### Local-first behavior

- Recognition runs entirely on the player’s device.
- Chest data, local items, thumbnails, and location images remain in IndexedDB.
- Do not add a cloud service, remote OCR API, remote image-recognition API, account requirement, telemetry pipeline, or silent upload.
- Recognition assets required at runtime must be bundled or cached so the scanner works offline after the application has loaded successfully.
- An optional mismatch export may create a local download for the player to share with the development team. It must never upload automatically.

### Presence-only tracking

- Track only whether an item is recorded in a chest.
- Do not track item quantities.
- Do not calculate owned totals.
- Do not claim that an item is currently present in the game. Phrase results as the location where the item was **last recorded**.
- Do not infer accurate occupied-slot counts from the saved, deduplicated item set.
- The temporary scan review may show how many visible slots were processed, but the saved chest summary must label its total as unique recorded items.

### Chest types and capture counts

- A regular Storage box has 20 slots and requires one complete screenshot.
- A Big storage box has 60 slots and requires three screenshots for complete coverage.
- A large-chest scan is one atomic scan session containing pages 1, 2, and 3. It is not three independent chest updates.
- Permit partial rescans, but label them clearly and preserve existing items from unseen pages.
- A complete rescan may replace existing contents only after explicit confirmation.

### Recognition boundaries

- OCR is not the primary item recognizer.
- Most slots display only an icon. Use visual matching against bundled catalog artwork for those slots.
- OCR is useful for visible interface text, especially the name of the currently selected item.
- The application must not train or retrain a model on the player’s device.
- Manual corrections update the chest record only. They must not change recognition weights, thresholds, embeddings, or future automatic predictions.
- If a slot cannot be matched confidently, leave it unresolved and let the player select or create the item manually.
- Never silently choose the closest item when confidence is inadequate.

### Player-created local items

- A player must be able to record an item that is absent from the bundled catalog, including items introduced by a newer DLC or game update.
- Local items are searchable immediately and can be selected again during later manual review.
- Local items remain separate from the bundled catalog.
- When a future bundled catalog version contains a possible match, suggest a player-confirmed link or merge. Never merge automatically.

### Chest limit

- Enforce a centralized, configurable upper limit.
- Use 100 chests as the initial product limit.
- Treat 100 as a provisional product limit, not a claim about browser capacity.
- Test storage and image budgets on supported browsers and keep the constant easy to revise.
- At the limit, explain that the player must edit or remove an existing chest. Never silently discard an older chest.

## Player experience

### Navigation

Add Storage as a top-level application destination after Items and before Housemates.

Recommended routes:

- #/storage — storage search and chest list
- #/storage/new — create chest flow
- #/storage/<chest-id> — chest detail and editing

Update:

- ParsedRoute and NavSection types.
- Route parsing, active-section calculation, remembered route behavior, and route availability.
- Navigation tests.
- App rendering and top navigation.
- Item details so an official catalog item can link to “Find in storage.”

Do not overload the existing Items directory with chest-management controls. Items owns catalog lookup; Storage owns the player’s location records.

### Storage landing page

The first view should make two jobs obvious:

1. Search for an item.
2. Create or open a chest.

Include:

- A search field covering official catalog items and player-created local items.
- Search suggestions that distinguish “Catalog” from “Saved by me.”
- Results showing every matching chest.
- Chest result information: chest name, region, location note, location image, and last-updated time.
- Empty search copy: “Not recorded in your chests.”
- A chest list grouped or filterable by region without forcing a region selection before search.
- A create-chest action.
- A helpful empty state explaining that the feature remembers where the player last recorded an item.

Do not add an “enable search” switch. Search is always available.

### Create chest flow

Collect:

- Region. Use the current catalog’s area/region vocabulary where appropriate; do not invent region identifiers.
- Chest name. Generate a sensible editable default such as “<Region> · Chest 01.”
- Chest type: Storage box (20 slots) or Big storage box (60 slots).
- Location screenshot or photo showing where the chest is in the game.
- Optional location note.
- Optional user-positioned marker on the location image if it can be implemented without making the flow cumbersome.

Allow saving an empty chest so a player can establish its location before cataloging contents.

Keep the location image separate from inventory scan images. They have different purposes and retention rules.

### Add contents

Offer:

- Add manually.
- Import native Switch screenshot.
- Upload a camera photo for manual crop and item assignment only.

Automatic recognition in the first release supports the benchmarked 1920 x 1080 native Switch screenshots. Detect unsupported dimensions or framing before recognition and explain that the player can continue with manual assignment. Do not run the native-screenshot matcher on a camera photo and present its result as reliable.

If mobile photo capture remains available, use a browser-native image input compatible with the rear camera. Do not require persistent camera permission or build a custom camera unless a validated need appears. Treat camera-photo recognition as a later milestone requiring its own passing benchmark.

Manual entry:

- Searches both official and local items.
- Adds item presence once even if selected repeatedly.
- Allows removal before saving.

Capture/upload:

- Storage box: request one page.
- Big storage box: show three explicit page positions.
- Allow images to be added in any order.
- Show progress such as “2 of 3 pages added.”
- Detect obvious duplicate images and warn before review.
- Let the player replace an individual page.
- Let the player correct page assignment when page-dot detection is wrong.

### Image preparation

For native Switch screenshots, perform locally:

1. Validate the expected 1920 x 1080 native frame and supported game layout.
2. Locate the upper storage panel and exclude the lower player inventory.
3. Identify the active page indicator when possible.
4. Divide the storage panel into the known two-row by ten-column slot grid.
5. Detect empty versus occupied slots.
6. Extract a normalized thumbnail for every occupied slot.
7. Preserve a manual crop/grid correction path for future UI or game-layout changes.

For camera photos or other unsupported images:

1. Respect or correct image orientation.
2. Let the player rotate and refine the crop.
3. Correct moderate perspective and scale when possible.
4. Use the normalized slots for manual item assignment.
5. Do not mark automatic matches as trusted until a camera-photo benchmark passes.

Do not pretend image count proves that the photos came from the same physical chest. Chest identity comes from the player choosing the chest record.

### Review

Review is mandatory before accepted scan results modify a chest.

For every occupied slot, show:

- The original cropped slot thumbnail.
- A proposed catalog match when confidence is adequate.
- A clear unresolved state otherwise.
- An action to correct any proposed match.
- An action to choose an official or existing local item.
- An action to create a new local item.

The player must be able to:

- Accept a proposed match.
- Replace a wrong match using catalog/local search.
- Create a local item for missing DLC content.
- Mark a crop as intentionally ignored if it is not an item the player wants recorded.
- Return to crop/page preparation.
- Cancel without changing the chest.

Combine all reviewed pages only at the final acceptance step. Deduplicate repeated item references because the product tracks presence, not stack quantity.

If unresolved slots remain, either:

- Require the player to resolve or intentionally ignore each one before acceptance; or
- Preserve small unresolved slot thumbnails in the chest with a visible “Review unidentified items” action.

Prefer the second behavior if it can be implemented without bloating storage. Never silently drop unresolved occupied slots.

### Accepted scan behavior

For a new chest:

- Save the reviewed, deduplicated item references once.

For a partial rescan:

- Merge reviewed items with current item references.
- Preserve all unseen existing items.
- Explain that removed items cannot be inferred from a partial scan.

For a confirmed complete rescan:

- Show that existing recorded contents will be replaced.
- Keep unresolved or intentionally retained entries visible during confirmation.
- Apply the replacement atomically.
- Provide undo.

After acceptance:

- Discard full inventory scan images by default.
- Retain only the small crops required for unresolved slots, player-created local item thumbnails, or an explicitly initiated mismatch export.
- Keep the independent chest-location image.

### Search results

Search official and local items by normalized name and aliases.

For an official item, support entry from:

- Storage search.
- The corresponding Items detail page.

Show:

- Every chest where the item was last recorded.
- Chest name.
- Region.
- Location screenshot.
- Location note.
- Last-updated date.

Do not show quantity, owned total, or guaranteed availability.

## Recognition design

### Required architecture

Create a recognition module with clean boundaries between:

- Image normalization and crop geometry.
- Page/slot segmentation.
- Empty-slot detection.
- OCR of selected labels.
- Visual item matching.
- Confidence policy.
- Review-state transformation.

Run expensive work in a Web Worker so the interface remains responsive.

Load recognition code, OCR assets, and any model lazily only when the scanner is opened. Do not burden normal Pokédex or catalog lookup.

### Reference set

Use stable catalog item ids and local artwork from /images/items/<item-id>.png.

At startup or build time:

- Audit catalog ids against baked artwork.
- Exclude missing or unreadable reference images from automatic visual matching.
- Report coverage in the development benchmark.
- Keep those items available for manual selection.

Do not modify stable catalog ids to accommodate recognition.

### Recognition strategy

Productionize the matcher that passed the native screenshot benchmark before evaluating alternatives:

1. Validate and crop the fixed native screenshot grid.
2. Estimate the shared slot background and isolate each item's foreground.
3. Build the color/shape descriptor used by the benchmark: HSV histogram, normalized silhouette, and aspect ratio.
4. Retrieve the strongest 100 color/shape candidates.
5. Use the benchmarked eight-table ORB locality-sensitive hash index to retrieve up to 400 keypoint candidates.
6. Rerank the union with exact ORB matching plus the color/shape score.
7. Return the top five candidates, score, and top-two margin for review.
8. Use the visible selected-item label as a strong independent signal only when local OCR produces a unique normalized catalog name.

The benchmark parameters are recorded in `benchmarks/storage-recognition/native-switch-manifest.json`. Do not change the crop geometry, descriptor, candidate counts, weights, or ORB settings without rerunning the same benchmark and recording the comparison.

Do not add an automatic-match threshold yet. The known-item dataset cannot establish rejection behavior. Build a held-out unknown-item benchmark first and derive both an absolute score threshold and a top-two margin threshold from measured false accepts.

If deterministic matching cannot achieve a useful false-positive rate:

- Evaluate a small packaged image-feature model running locally through a browser-compatible runtime such as ONNX Runtime Web.
- Use the model only for inference or embeddings.
- Do not train in the browser.
- Keep a WebAssembly/CPU fallback for browsers without WebGPU.
- Measure model download size, initialization time, memory, and per-page recognition time on mobile.

OCR:

- A browser-local implementation such as Tesseract.js is acceptable.
- Use it only after orientation and crop normalization.
- Reuse one worker during a multi-page scan.
- Bundle or cache required worker, WebAssembly, and language assets.
- Do not treat OCR output as trustworthy without catalog normalization and review.

Image-processing libraries:

- Prefer native Canvas/ImageBitmap APIs for straightforward operations.
- OpenCV.js materially improved recognition in the completed benchmark and `@techstark/opencv-js` is pinned at `5.0.0-release.1` as a development dependency. Reuse it for the benchmark-equivalent ORB implementation unless a replacement passes the same gate.
- Keep OpenCV.js out of the initial application bundle. Load it only inside the recognition worker when the scan flow starts.
- Pin dependency versions and keep their assets local.

### Confidence outcomes

The recognizer must return one of:

```ts
type RecognitionOutcome =
  | {
      status: "matched";
      itemId: string;
      score: number;
      margin: number;
      source: "visual" | "ocr" | "combined";
    }
  | {
      status: "unresolved";
      candidates: Array<{ itemId: string; score: number }>;
      reason:
        | "low-score"
        | "ambiguous"
        | "missing-reference"
        | "poor-image"
        | "no-item";
    };
```

The interface may use candidates to speed manual search, but it must not present an unresolved candidate as an identified item.

### No consumer-side learning

Do not:

- Add corrected crops to an on-device training set.
- Update model weights.
- Change reference embeddings from user corrections.
- Change global thresholds.
- Promote an accepted automatic prediction into training data.

A correction affects only the reviewed scan/chest record.

### Optional development mismatch export

Provide a secondary, explicit action such as “Export recognition issue.”

The exported package may contain:

- The small normalized slot crop.
- The player-selected official catalog id or local item name.
- Top candidate ids and scores.
- Recognizer/reference version.
- Non-sensitive processing metadata such as detected rotation and image quality.

Exclude:

- Full location photographs.
- Full chest screenshots.
- Other chest contents.
- Player notes.
- Any automatic upload destination.

The development team may later review these packages, improve bundled reference examples, recalibrate matching, or retrain an offline model. That process is outside the consumer application.

## Recognition benchmark evidence and required follow-up

The known-item feasibility benchmark is complete. Do not replace it with a toy test, reduce its catalog search space, or relabel its data to improve results.

### Native Switch screenshot dataset

- Source folder: `docs/research/storage-samples`
- Manifest and truth labels: `benchmarks/storage-recognition/native-switch-manifest.json`
- Reproducible runner: `scripts/benchmark-native-storage-recognition.mjs`
- Findings: `docs/research/storage-recognition-benchmark.md`
- Generated JSON and visual report: `.artifacts/storage-recognition-native`
- Input: ten 1920 x 1080 Switch screenshots.
- Six unique pages across two Big storage boxes; four byte-identical captures are excluded.
- Occupied slots: 106.
- Manually verified labels: 30.
- Search space: 1,765 usable catalog images.
- Result: 29/30 top-1 (96.7%) and 30/30 top-3 (100%).
- Known miss: Tabletop mic ranked second behind Nugget.
- Runtime on the development machine: 27.0 seconds to build reference features, 168.4 seconds to score the labeled targets, 196.7 seconds total.

The pass gate is at least 30 labels, at least 90% top-1, and at least 98% top-3. Any production matcher change must continue to pass this benchmark.

### Camera-photo dataset

The original three user-provided 3000 x 4000 handheld photographs remain a negative control:

- `/Users/ashishtripathi/Downloads/20260915_221428.jpg`
- `/Users/ashishtripathi/Downloads/20260915_221436.jpg`
- `/Users/ashishtripathi/Downloads/20260915_221441.jpg`
- Result: 1/3 top-1 and 2/3 top-3.

Keep `scripts/benchmark-storage-recognition.mjs` reproducible, but do not use this failed sample to claim camera-photo support. A future camera milestone needs at least 30 independently labeled occupied slots from multiple screens, angles, and lighting conditions and must pass the same known-item gate.

### Required unknown-item benchmark

Before the application may automatically accept a visual match:

1. Create at least 30 non-catalog or deliberately held-out item cases without training or tuning on those evaluation crops.
2. Run the production matcher and record top score, top-two margin, proposed identity, and whether the result was accepted or unresolved.
3. Set a declared false-accept target, then derive the absolute score and margin thresholds from the measurements.
4. Report confident wrong matches and unresolved rate alongside known-item top-1 and top-3 accuracy.
5. Keep below-threshold cases unresolved and allow catalog search or local-item creation.

An unresolved result is acceptable; a confidently wrong result is materially worse. Until this benchmark exists, all matches require explicit player review.

### Benchmark integrity

The production recognizer and benchmark must share the same normalization, descriptors, candidate retrieval, ranking, and confidence code. The runner must:

1. Preserve source images.
2. Verify declared duplicate files by hash and exclude them from scoring.
3. Search the entire usable reference catalog before shortlist reranking.
4. Keep truth labels in the manifest and never inject the truth item into a candidate list.
5. Emit machine-readable JSON and a visual HTML report with crops and top candidates.
6. Report dataset size, reference coverage, accuracy, rejection behavior, and timing.

Do not fabricate accuracy, hide excluded cases, or ship thresholds chosen without evidence.

## Player-created local items

### Creation

When a slot is unresolved, search:

1. Official catalog items.
2. Existing local items.
3. “Create local item.”

Creating a local item requires:

- Name.
- A generated stable local id using a local namespace, such as local:<uuid>.
- Normalized name for duplicate detection.
- Optional note.
- Optional slot thumbnail, defaulting to the unresolved crop.
- Created and updated timestamps.

Before creation, warn when another local or official item has the same normalized name. Let the player choose the existing item or deliberately continue with a distinct local item.

### Identity

Use a union rather than mixing local ids into the official catalog:

```ts
type StorageItemRef =
  { kind: "catalog"; itemId: string } | { kind: "local"; localItemId: string };
```

Do not turn free-text chest entries into identity. All saved searchable items need a stable official or local id.

### Local item management

Support:

- Rename.
- Edit note.
- Replace/remove thumbnail.
- View every chest referencing the local item.
- Merge duplicate local items with confirmation.
- Delete only when no chest references it, or require the player to remove/replace all references.

### Catalog refresh reconciliation

The current catalog is bundled and versioned. “Catalog sync” means a later application/catalog refresh unless a separate update channel is explicitly implemented.

When catalog.version changes:

1. Compare unresolved local items with new official catalog entries using normalized names and optional visual similarity.
2. Show suggestions, not automatic merges.
3. Let the player confirm “Link to catalog item.”
4. Replace all chest references transactionally.
5. Preserve the old local name as an alias or migration record.
6. Provide undo.

Never discard a local item merely because a similar official item appears.

## Recommended persistence architecture

Do not place full-resolution image data inside the existing main state record. Large nested blobs would make every small notebook update rewrite all images.

Prefer a Dexie schema upgrade with feature-specific tables in the same pokopia-fieldnotes database:

```ts
interface StorageChest {
  version: 1;
  id: string;
  name: string;
  regionId: string;
  type: "storage-box" | "big-storage-box";
  locationNote?: string;
  locationImageId?: string;
  itemRefs: StorageItemRef[];
  unresolvedSlots?: Array<{
    id: string;
    imageId: string;
    page: number;
    slot: number;
  }>;
  createdAt: string;
  updatedAt: string;
  lastCompleteScanAt?: string;
  lastScanKind?: "manual" | "partial" | "complete";
  catalogVersion: string;
}

interface LocalStorageItem {
  version: 1;
  id: string;
  name: string;
  normalizedName: string;
  aliases: string[];
  note?: string;
  thumbnailImageId?: string;
  linkedCatalogItemId?: string;
  createdAt: string;
  updatedAt: string;
}

interface StorageImage {
  id: string;
  kind: "location" | "local-item" | "unresolved-slot";
  ownerId: string;
  mimeType: "image/webp" | "image/jpeg" | "image/png";
  width: number;
  height: number;
  byteLength: number;
  blob: Blob;
  createdAt: string;
}
```

Recommended stores:

- state — retain the existing main notebook state.
- storageChests — chest metadata and item references.
- storageLocalItems — player-created item identities.
- storageImages — compressed image blobs.

Use Dexie transactions for operations spanning records. Protect against orphaned images after failed creates, replacements, deletes, imports, and undo.

If current code architecture makes a different schema materially safer, document the reason before changing this recommendation. The observable requirements, backup completeness, atomicity, and performance are binding.

### Image budgets

Create centralized constants and document them.

Initial targets:

- Maximum 100 chests.
- Location image: resize to a maximum long edge around 1,280 pixels and encode efficiently, preferring WebP with a JPEG fallback.
- Local item/unresolved slot thumbnail: approximately 160 × 160.
- Reject or ask the player to retry when an image remains unreasonably large after compression.
- Check navigator.storage.estimate() where available and show a useful storage warning before writes fail.
- Consider requesting persistent browser storage through navigator.storage.persist() from an explicit, user-initiated storage action; do not claim that persistence is guaranteed.

Test and adjust byte limits on supported mobile and desktop browsers. Do not equate the 100-chest product limit with browser quota.

## Backup, restore, and migration

Storage records and images are part of “My notebook” and must survive export/import.

Requirements:

- Continue importing existing legacy JSON backups containing only SaveState.
- Export a new versioned backup envelope containing:
  - Existing SaveState.
  - Storage chests.
  - Local items.
  - Required images encoded safely for backup.
  - Backup and feature schema versions.
- Validate every imported field before replacing data.
- Validate official ids against the current catalog.
- Validate local ids, reference integrity, uniqueness, timestamps, chest type, region, image metadata, MIME type, and size limits.
- Preserve valid local items even when the official catalog has changed.
- Detect missing image references and present a clear import error or a documented recovery behavior.
- Preview counts before replacement: chests, local items, location photos, and unresolved items.
- Replace notebook state and storage tables atomically.
- Keep current data untouched when validation or replacement fails.
- Update the current 5 MB import assumption to a tested limit appropriate for compressed chest images.
- Do not silently strip storage data when an export is re-imported.

Use a new backup-envelope version rather than blindly changing the meaning of the existing SaveState schemaVersion. Maintain explicit migration functions and tests.

## Undo and destructive actions

Provide undo for:

- Accepted manual-content edits.
- Partial scan acceptance.
- Complete scan replacement.
- Local-item merge into another local item.
- Confirmed local-to-official catalog linking.

Chest deletion must require confirmation and describe that its location image and recorded contents will be removed.

Ensure images needed for an available undo are not garbage-collected before the undo expires. Garbage-collect unreferenced images deliberately and test it.

Do not use the current global undo implementation blindly if it cannot safely cover the feature’s separate Dexie tables. A feature-scoped transactional undo log is acceptable.

## Error and edge states

Handle:

- Camera/upload cancellation.
- Unsupported image format.
- Huge image.
- Corrupt image.
- Orientation metadata missing or wrong.
- Chest panel not detected.
- Crop outside image bounds.
- Perspective correction failure.
- Missing page.
- Duplicate page.
- Incorrect page-dot detection.
- Empty chest.
- Partially filled last page.
- More than one identical item stack.
- Missing catalog artwork.
- OCR unavailable.
- Recognition worker/model failing to load.
- Recognition cancelled.
- Browser storage unavailable.
- QuotaExceededError.
- Import/export failure.
- Local item with duplicate name.
- Catalog update removing or renaming a previously referenced item.
- A chest or local item referenced by a stale route.

Every failure needs a recovery path. Image-recognition failure must fall back to manual catalog/local-item selection rather than block chest creation.

## Accessibility and responsive behavior

- The full flow must work at approximately 390 px wide and on desktop.
- Use semantic controls and existing component conventions.
- Every icon-only button needs an accessible name.
- Crop/rotate controls must be keyboard operable or provide equivalent accessible numeric/actions.
- Do not rely on color alone for matched, unresolved, ignored, or local-only states.
- Announce scan progress and completion through appropriate live regions without announcing every processing frame.
- Preserve visible focus.
- Provide useful loading states while OCR or recognition runs.
- Do not trap the player in a modal-heavy flow. Use a full page or staged sheet where the task needs space.
- Keep buttons and image-review targets usable on touch devices.
- Respect reduced motion.

## Performance requirements

- Normal application startup and non-Storage routes must not eagerly load recognition libraries or models.
- Process images off the main thread.
- Release ImageBitmap, canvas, tensor, worker, and object-URL resources.
- Reuse one OCR/recognition worker during a multi-page scan and terminate it when the flow ends.
- Avoid comparing full-resolution photographs to every catalog image.
- Do not reproduce the benchmark's 196.7-second runtime in the player flow.
- Precompute and version catalog color/shape and ORB reference features at build time. Do not rebuild all 1,765 reference descriptors for each scan.
- Load the precomputed index once per scan session and reuse it across all one or three pages.
- Optimize candidate reranking and measure with all occupied slots, not only the 30 labeled benchmark slots.
- Preserve the benchmark result after every optimization. Performance work may not weaken accuracy gates, reduce the reference catalog, or use truth labels during retrieval.
- Show determinate page/slot progress where possible and always provide cancellation.
- Persist only the image sizes required by the product.
- Measure and report:
  - Added initial bundle size.
  - Lazy OpenCV/recognition worker and reference-index size.
  - Recognition initialization time.
  - Processing time for one regular page and three large-chest pages.
  - Time spent loading the reference index, segmenting slots, retrieving candidates, and reranking.
  - Peak behavior on a representative mobile viewport/device when available.

## Suggested source layout

Adapt names to existing conventions, but keep concerns separated. A reasonable structure is:

```text
src/storage/
  StoragePage.tsx
  ChestDetail.tsx
  ChestForm.tsx
  ScanFlow.tsx
  ScanReview.tsx
  LocalItemEditor.tsx
  types.ts
  repository.ts
  search.ts
  validation.ts
  backup.ts
  images.ts
  recognition/
    types.ts
    worker.ts
    normalize.ts
    panel.ts
    slots.ts
    ocr.ts
    matcher.ts
    confidence.ts

scripts/
  build-storage-references.mjs
  benchmark-native-storage-recognition.mjs
  benchmark-storage-recognition.mjs

tests/
  storage.test.ts
  storage-persistence.test.ts
  storage-navigation.test.ts
  storage-recognition.test.ts

docs/research/
  storage-recognition-benchmark.md

benchmarks/storage-recognition/
  native-switch-manifest.json
  manifest.json
```

Do not create empty architectural wrappers. Add files only when they own a coherent responsibility.

## Implementation order

### Phase 1: Verify and productionize the completed recognition benchmark

- Read the existing manifests, benchmark runner, report, and measured limitations.
- Reproduce the native benchmark before modifying the matcher.
- Extract shared production recognition code so the benchmark and application execute the same algorithm.
- Precompute and version catalog descriptors and the ORB retrieval index at build time.
- Move scan-time work into a lazy Web Worker and add cancellation and progress.
- Re-run the native benchmark after optimization and preserve at least 90% top-1 and 98% top-3.
- Add the unknown-item benchmark before enabling any automatic acceptance threshold.
- Keep camera-photo recognition disabled unless a separate camera dataset passes.

### Phase 2: Domain model and manual-first storage feature

- Add the Dexie schema migration and repositories.
- Add typed chest, local item, image, and item-reference models.
- Implement Storage navigation, list, create, edit, delete, manual contents, and search.
- Add local-item creation and search.
- Add item-detail links.
- Implement backup/import migration before accumulating user data that cannot be exported.

The manual path must be complete and usable independently of automatic recognition.

### Phase 3: Scan preparation and review

- Add native Switch screenshot import and unsupported-image detection.
- Keep optional phone-camera upload on the manual crop/assignment path.
- Add orientation, crop, page assignment, duplicate detection, grid segmentation, slot extraction, and occupied-slot review.
- Allow fully manual assignment of every extracted slot before the recognizer is integrated.

### Phase 4: Local recognition

- Integrate the benchmarked color/shape and ORB matcher through the shared worker code.
- Return the top five candidates for mandatory review.
- Add selected-label OCR only as an independent local signal; do not replace icon matching with OCR.
- Add lazy loading, worker execution, cancellation, progress, confidence outcomes, and fallbacks.
- Keep correction behavior independent of model state.

### Phase 5: Rescan, reconciliation, undo, and hardening

- Add partial merge and confirmed complete replacement.
- Add local-item duplicate merge and later catalog reconciliation.
- Add feature-scoped undo and image garbage collection.
- Add optional mismatch export.
- Harden quota, corruption, missing-reference, and offline states.

### Phase 6: Verification

- Run targeted tests during implementation.
- Run the complete test suite and production build using Node 22.
- Browser-test desktop and real 390 px mobile layouts.
- Test reload persistence.
- Test legacy backup import.
- Test new backup export/re-import including images and local items.
- Test offline recognition after assets are cached.
- Test one-page Storage box and three-page Big storage box flows.
- Test partial and complete rescans.
- Test incorrect automatic match correction.
- Test missing-DLC local item creation and search.
- Test later player-confirmed local-to-official linking.
- Test the 100-chest limit without creating oversized fixtures in normal tests.

## Required automated tests

At minimum, cover:

- Route parsing, active nav, remembered Storage route, and stale detail route fallback.
- Chest validation and centralized chest limit.
- Presence-only deduplication.
- Manual addition/removal of official and local item references.
- Local-item normalized-name collision handling.
- Search across official and local identities.
- Multi-chest results for one item.
- Small one-page and large three-page scan-session rules.
- Duplicate/missing page detection.
- Partial rescan preserves unseen items.
- Complete rescan replacement requires the explicit complete path.
- Cancelled review leaves persisted contents unchanged.
- Invalid recognition output cannot create an item reference.
- Missing catalog image becomes unresolved.
- Local items survive reload and backup round-trip.
- Legacy backups import with empty Storage data.
- New backup validates and restores images and references.
- Failed import preserves existing database contents.
- Local-item merge rewrites all references atomically.
- Catalog reconciliation never merges without confirmation.
- Undo conflict handling.
- Image garbage collection does not delete referenced or undo-protected images.
- Quota/write failure produces an actionable error.

Do not write tests that merely duplicate implementation. Test product invariants, migrations, destructive boundaries, and fallback behavior.

## Acceptance criteria

The feature is complete only when all of these are true:

1. A player can create, rename, edit, and delete a chest with region, type, location image, and note.
2. A player can save a chest without contents.
3. A player can add official and local items manually.
4. A player can import one native Switch screenshot for a Storage box or three for a Big storage box.
5. A player can correct page ordering and use manual crop/assignment for unsupported images.
6. The app extracts occupied slots from supported native screenshots without including the lower player inventory.
7. The production matcher continues to clear the recorded native benchmark gate of at least 90% top-1 and 98% top-3 across the full usable catalog.
8. Every automatic result remains a reviewable proposal until the unknown-item rejection benchmark establishes confidence thresholds.
9. Every proposed match can be corrected before acceptance.
10. No recognition or OCR request leaves the device.
11. No on-device model training or learning occurs.
12. A missing catalog/DLC item can be named, saved locally, found in search, and reused in later manual selection.
13. Local items can later be linked to new official catalog items only after player confirmation.
14. Search returns all matching chests with region, location image/note, and last-updated time.
15. Results use “recorded” language and never claim current ownership or quantity.
16. Partial rescans preserve unseen contents.
17. Complete rescans replace contents only after confirmation and can be undone.
18. Full scan images are discarded after acceptance unless needed for an explicit unresolved/mismatch action.
19. All data and required images survive reload and backup export/import.
20. Legacy backups still import.
21. Recognition failures fall back to manual entry.
22. The 100-chest limit is enforced without data loss.
23. The feature works on desktop and approximately 390 px mobile width without overflow or clipped controls.
24. Tests and the production build pass under Node 22.
25. The benchmark report states actual measured results, timing, exclusions, and limitations.
26. Production recognition uses precomputed versioned reference features and does not rebuild the complete catalog index for every scan.

## Prohibited shortcuts

Do not:

- Claim OCR recognizes icon-only slots.
- Send images to a remote multimodal model or OCR service.
- Train from player corrections.
- Save arbitrary free text directly in chest itemRefs.
- Drop unknown DLC items.
- Auto-merge local items with a later catalog.
- Add scan quantities to existing records.
- Treat three uploaded images as three separate large chests.
- Replace existing contents from a partial scan.
- Treat “three images uploaded” as proof of complete or same-chest coverage.
- Persist full scan photos indefinitely.
- Put uncompressed full-resolution photos in the main notebook state.
- Break existing backup imports.
- Claim browser tests passed when only unit tests or builds ran.
- Claim recognition accuracy without a labeled benchmark.
- Claim native screenshot benchmark results apply to handheld camera photos.
- Automatically accept a visual match before the unknown-item rejection benchmark establishes score and margin thresholds.
- Weaken the native benchmark by reducing the catalog, injecting the truth candidate, or scoring duplicate screenshots.
- Ship the current 196.7-second benchmark path as the player-facing scan implementation.
- Change unrelated catalog, crafting, habitat, or housemate behavior.

## Final handoff

When finished, report:

- What changed and the player-visible behavior.
- Files and schema migrations added.
- Recognition method selected and why.
- Exact native benchmark dataset size, duplicate exclusions, catalog coverage, top-1/top-3 metrics, and the Tabletop mic failure.
- Unknown-item rejection dataset, false-accept target, measured result, and derived thresholds if automatic acceptance was enabled.
- Catalog-reference coverage and missing-image behavior.
- Initial bundle, lazy OpenCV worker, and reference-index sizes.
- Measured initialization and processing times for one-page and three-page native screenshot scans, compared with the 196.7-second research baseline.
- Tests and build commands run with results.
- Desktop and mobile browser checks performed.
- Backup/import and offline checks performed.
- Any real-device camera checks that remain unverified; do not generalize native screenshot results to camera photos.
- Known recognition failure modes and how the manual fallback handles them.
- Any provisional limits that should be revisited with broader device testing.

Do not describe the feature as complete while any acceptance criterion is unverified. Distinguish implemented behavior, automated evidence, browser evidence, real-device evidence, and remaining limitations.
