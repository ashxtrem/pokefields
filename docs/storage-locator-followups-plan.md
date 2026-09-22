# Storage Locator — follow-up improvements plan

## Context

The Storage Locator feature (chest records, manual/scan-based contents, on-device recognition, first-visit guide) is live. This plan covers eight follow-up requests gathered from real usage: an optional per-item quantity for the player's own tracking, a "replace item" action, a location-photo zoom, an in-chest contents search, a fix for empty slots showing up as unidentified during scans, a search box on the chest detail page, a click-to-explain popup on contents-list items (matching the Pokédex/Habitats/Items pattern), and a mobile button-alignment fix on the chest detail page.

Two of these (4 and 6) turned out to be the same request — an in-chest contents filter — and are merged into one item below.

None of these are committed to code yet. This document is the plan; implementation follows once it's reviewed.

## 1. Optional per-item quantity (user tracking only)

**Decision this must respect:** the master prompt is explicit that Storage is presence-only — *"Do not track item quantities. Do not calculate owned totals."* The point of that rule is that the app has no live connection to the game, so any number it computed or asserted would go stale immediately and mislead the player. This request doesn't violate that as long as quantity is treated purely as the **player's own optional annotation** — the app must never sum it, display an "owned total," use it in search/matching, or claim it reflects the current game state. It's the numeric sibling of `locationNote`: a free field the player sets and reads back, nothing more.

**Data model** (`src/storage/types.ts`): add `quantity?: number` directly onto both `StorageItemRef` variants:
```ts
export type StorageItemRef =
  | { kind: "catalog"; itemId: string; quantity?: number }
  | { kind: "local"; localItemId: string; quantity?: number };
```
Identity/comparison functions (`sameItemRef`, `itemRefKey`) already only look at `kind`/`itemId`/`localItemId`, so they're unaffected — quantity never participates in identity or dedup.

**Validation** (`src/storage/migration.ts`'s `readItemRef`): accept an optional `quantity`, requiring a positive integer when present, same style as the existing field checks.

**Where it's settable, per your ask — all three places:**
- **`ItemPicker.tsx`**: add a small optional quantity input next to each search result / the "create local item" action, defaulting to blank (meaning "not tracked"). Also used by `ScanReview.tsx`'s "Replace" flow, which reuses `ItemPicker`.
- **`ScanReview.tsx`**: each accepted slot gets an optional quantity input alongside its Accept/Replace/Ignore controls, defaulting to blank.
- **`ChestDetail.tsx`**: each contents row gets an inline, always-visible quantity field (small number input, blank = untracked) next to the item name.

**Behavior decision (flagging for your review):** if the player adds an item that's already in the chest (via search), instead of silently no-oping as it does today, the existing row's quantity is updated (summed, since presence is unaffected) rather than the pick being dropped — otherwise "add quantity" would feel broken the moment an item is already present. Presence-only dedup (one row per identity) is unchanged; only the display number moves. Say if you'd rather it just overwrite instead of sum, or require an explicit edit instead of updating on re-add.

**New/changed functions:**
- `repository.ts`: `withItemRefQuantity(chest, ref, quantity)` (pure, mirrors `withItemRefRemoved`'s style), and adjust `withItemRefsAdded` to merge quantity instead of no-op on a duplicate.
- `context.tsx`: `setItemQuantity(chestId, ref, quantity)` mutator, following the existing `removeItemRef`/`addItemRefs` pattern (no undo needed for a pure annotation edit, matching how `resolveUnresolvedSlot` also skips undo).

**Backup/tests:** extend `tests/storage.test.ts` (quantity merge-on-readd, validation) and `tests/storage-persistence.test.ts` (round-trips through export/import).

## 2. Replace an item in the contents list

Already half-built: `ScanReview.tsx`'s per-slot "Replace" button already opens `ItemPicker` and swaps the ref in place. `ChestDetail.tsx`'s contents rows only have remove (✕) today.

**Change:** add a "Replace" affordance per row in `ChestDetail.tsx`, opening the same `ItemPicker` inline (same pattern already used for `adding` and `resolvingSlotId`), and on pick, call a new `replaceItemRef(chestId, oldRef, newRef)` context mutator (repository-level pure function `withItemRefReplaced`, preserving quantity across the swap by default, dedupe-safe if the new ref already exists elsewhere in the chest).

## 3. Location photo zoom

`StorageImageThumb` renders a plain `<img>` with no click behavior today; `ChestDetail.tsx`'s header thumbnail (`storage-location-hero`) is static.

**Change:** make the header location thumbnail (and the small thumbnail on each chest card in `StoragePage.tsx`'s list, since the same component is reused there) open a lightbox — a `Modal` containing the full-resolution stored image (location images are already capped at ~1280px long edge, so "full-resolution" here just means the already-compressed stored copy, no extra data needed). New small component, e.g. `StorageImageLightbox.tsx`, or inline state in `ChestDetail`/`StoragePage` opening a shared `Modal` with a large `<img>`.

Scoped to the **location photo only**, per your call — see the discussion below on why the original scan screenshot isn't available to zoom into.

*(Not in scope, noted for completeness): the original full box screenshot is deliberately discarded right after a scan is accepted — the master prompt requires this to avoid unbounded storage growth. Only small unresolved-slot crops survive. If you ever want a "view the box screenshot" affordance, that needs a separate decision to retain some form of the scan image, which is a real storage-budget trade-off, not a small addition — flag it separately if you want it.)*

## 4/6. Search within a chest's contents

Your #4 ("show only items in chest we have, not all in search or filter") and #6 (add search to the chest detail page) are the same feature: a filter box on `ChestDetail.tsx` that searches **only the chest's own recorded `itemRefs`**, not the wider catalog/local-item universe — distinct from the existing "Add item" `ItemPicker`, which intentionally does search everything (it's for adding new things).

**Change:** add a small text input above the `Contents` list in `ChestDetail.tsx`; filter `chest.itemRefs` client-side by matching `resolveItemRefName(ref, ...)` against the query (reusing the existing `normalizeItemName`/substring-match convention already used in `search.ts`). No new backend function needed — this is a pure render-time filter, most useful once a Big storage box has 40-60 items.

## 5. Stop empty slots from showing as "unidentified"

**What's actually happening:** during a scan, `src/storage/recognition/slots.ts`'s `classifySlot` isolates a slot's foreground against a per-scan median background (`core/foreground.mjs`). A slot is only treated as "occupied" if a connected component survives two pinned constants: `FOREGROUND_DIFF_THRESHOLD = 35` (pixel-difference cutoff) and `FOREGROUND_MIN_COMPONENT_SIZE = 5` (minimum pixel count to count as a real object). A 5-pixel minimum, out of a 92×92 = 8,464-pixel crop, is a very low bar — subtle JPEG compression blocking or lighting gradient noise in a genuinely empty slot can plausibly clear it, producing a spurious tiny "component" that then shows up in review as an unresolved item requiring a manual Ignore.

**Why this needs care, not a quick edit:** both constants live in `src/storage/recognition/core/foreground.mjs`, which is extracted verbatim from the already-passed, gate-checked benchmark (`scripts/benchmark-native-storage-recognition.mjs`, ≥90% top-1 / ≥98% top-3 on the labeled set). The master prompt requires any change to this shared, pinned math to be re-verified against that benchmark before shipping — "if bigger change, leave" is exactly the signal to check that first rather than assume it's safe.

**Investigation result — deferred, no change made:** the labeled manifest turned out to include one real sample with genuinely empty slots after all: `159485.jpg` (Big storage box, page 3) has only 6 of 20 slots occupied per `benchmarks/storage-recognition/native-switch-manifest.json`. A diagnostic pass (background built from all 20 slots, exactly like production's `buildScanBackground`, then measuring the connected-component size `isolateForeground` finds per slot) gave:

| slot | truth | component size |
|---|---|---|
| 1–6 (occupied) | item present | 952 – 3671 px |
| 7–20 (empty) | nothing | **0 px, every slot** |

With the current `FOREGROUND_MIN_COMPONENT_SIZE = 5`, all 14 genuinely empty slots already resolve to zero foreground pixels and are correctly dropped (`isolateForeground` returns `null` → `occupied: false` → never shown, not even as "unresolved") — no false positive on the one real empty-slot sample available. Occupied items sit 200-700x above the current floor, so there's no evidence the floor is the problem, and raising it on a hunch risks suppressing genuinely small item icons for no measured benefit.

**Conclusion, per "if bigger change leave":** left unchanged. This isn't a case of the fix being too large — it's that the one piece of real evidence available says the pipeline already does the right thing, so changing a benchmark-pinned constant with no reproducing case would be a blind edit, not a fix. If empty slots are still showing up as unidentified in an actual play session, the concrete next step is a copy of that screenshot (or the unresolved-slot crop the app already keeps, which is small and doesn't need the full image) — that would show whether it's a different failure mode entirely (e.g. panel-texture variation the median background doesn't fully cancel, or a scan session where background estimation itself is thrown off by something other than the 5px floor).

## 7. Click a contents-list item to open its detail popup

Matches the existing pattern used in the Pokédex/Habitats/Items directories: `ItemButton` (`src/ui/components.tsx`) opens `ExplainDialog`, which renders rich per-item info (image, "where to find it," recipes, categories) via `explainTerm()` in `src/dex/glossary.ts`.

**Change, split by item kind:**
- **Catalog items**: replace the plain `<span>{name}</span>` in `ChestDetail.tsx`'s contents row with `ItemButton` wired to open `ExplainDialog`, exactly as `ItemDetail.tsx`/habitat pages already do. This is a drop-in reuse of existing, working code — no new dialog needed.
- **Local items**: `ExplainDialog`/`explainTerm` only knows about catalog data, so a local item's row instead opens the existing `LocalItemEditor` — already built, currently only reachable via the small "Saved by me" badge. Extend the click target to the item name/row itself, not just the badge.

## 8. Fix mobile button alignment on the chest detail page

Confirmed by screenshot at 390px: `Edit chest` and `Import screenshot` sit on one row, and `Delete chest` wraps alone onto a second row, left-aligned with a lot of empty space beside it — the existing `.button-row` class is a plain `flex-wrap: wrap`, fine for two buttons, awkward for three at this width.

There's already a precedent for this exact situation elsewhere in the app: `.habitat-build-actions` switches to a stretched, stacked column (`flex-direction: column; align-items: stretch`) under the `max-width: 600px` breakpoint. 

**Change:** give the chest-detail action row its own class (e.g. `storage-chest-actions`) instead of the bare `.button-row`, and add the same stacked/stretched treatment at the existing 600px breakpoint — scoped to this one row so the many other `.button-row` usages (modal confirmations, etc., which look fine wrapped) are untouched.

## Suggested order

1. **8** (mobile button fix) — pure CSS, zero risk, ship first.
2. **3** (location photo zoom) and **4/6** (in-chest search) — independent, low-risk UI additions.
3. **7** (click-to-explain) — independent UI reuse of existing components.
4. **2** (replace item) — small, reuses `ItemPicker`.
5. **1** (quantity) — the real data-model change; do this once the above are settled since it touches the most files (types, migration, repository, context, `ItemPicker`, `ScanReview`, `ChestDetail`, backup, tests).
6. **5** (empty-slot false positives) — separate track, gated on the benchmark re-run; can happen in parallel with the above since it only touches the recognition pipeline.

## Verification (for all items)

- `npx tsc -b`, `npm run test`, `npm run build` after each item.
- Manual browser check at desktop and ~390px width for every UI change.
- Item 5 specifically also requires `npm run benchmark:storage-native` to re-clear the ≥90%/98% gate before shipping.
