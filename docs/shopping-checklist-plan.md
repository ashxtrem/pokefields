# Habitat and house shopping checklist

Date: 9 September 2026
Status: historical plan; partially implemented, then superseded by `habitats-and-shopping-implementation-plan.md` on 9 September 2026. The habitat build lifecycle and shopping-checklist system described here (and in that successor) were later removed entirely in favor of lightweight habitat location records; see `docs/habitat-location-and-build-tracker-removal-plan.md`. Kept as historical context only.

[Certain] The replacement plan introduces a dedicated Habitats page, location-based build records and partial gathered quantities. Checkbox-only progress and habitat-list placement in Housemates below are historical decisions, not the current implementation target.

## Purpose

[Likely] Help the player gather what they need for a chosen build without maintaining an inventory. The core action is **“I have everything needed for this row.”** A tick records readiness for that build, not ownership across the game.

[Certain] The requested scope covers both Pokémon encounter habitats and planned houses.

## Existing foundations

[Certain] Verified in the current source:

- `src/dex/DexPage.tsx`: habitat cards already show artwork, requirement rows and owned-material number inputs, using requirement parsing and item resolution from `src/dex/glossary.ts`.
- `src/planner/PlannerPage.tsx`: Combined supplies shows aggregated construction quantities and suggested furnishings as plain lists.
- `src/planner/recommend.ts`: `combinedSupplies` sums kit materials across homes and counts suggested furnishings once per home.
- `src/planner/HomeDetail.tsx`: individual homes expose construction materials and furnishing details.
- `src/persistence/store.ts` and `src/progress/context.tsx`: progress is saved locally; backups have explicit validation. Existing `materialCounts` is separate from planner progress.
- Habitat requirements are strings; house kit materials have names and numeric quantities. Not every habitat requirement is a purchasable or collectable item.

## Proposed experience

[Likely] The following defines the proposed first release, not existing behavior.

### Habitat checklist

- Add **Start shopping checklist** to each habitat card in Pokémon details.
- Start only the selected habitat, not every alternative habitat belonging to that Pokémon.
- Show its picture, name, Pokémon context and required items with the recorded quantities.
- Use a checkbox per item row. Label the action **Have enough**; checking `Wood × 10` means all ten are ready. No partial quantity entry.
- Keep placement, terrain and other non-item instructions in a separate **Setup requirements** section. Keep time/weather information visible as reference. Neither contributes to shopping completion.
- Preserve ambiguous requirements verbatim under **Needs review** rather than inventing an item or quantity. A list with unresolved shopping requirements cannot claim all supplies are ready.
- Give active lists a shared **Shopping lists** section within the planner so they can be reopened without searching for the Pokémon again. Pokémon details opens the same saved checklist.
- Reopening the same habitat opens its existing active list. Before implementing deduplication, audit whether habitat IDs are shared consistently across Pokémon; use a stable source identity and requirement signature where necessary, never just the display name.
- First release supports one active build per distinct habitat. Multiple simultaneous copies and named build locations are deferred.

### House checklist

- Turn the existing Combined supplies section into **House shopping checklist** for the saved housemate plan.
- Keep **Required construction materials** and **Suggested furnishings** separate. Explain that furnishings are suggestions; their incomplete status does not block construction readiness.
- Keep the existing aggregated totals: one checkbox for each full construction total and one for each furnishing total.
- Show a small progress count for each section, such as **3 of 8 material types ready**. Count rows, not individual units.
- Leave individual home material lists as reference views in the first release, with a link to the combined checklist. Do not introduce conflicting per-home and aggregate check states.
- Keep food, care, helpers, build time and environment guidance outside the shopping progress count.
- A draft replacement plan can preview requirements but cannot overwrite or modify saved checklist progress until applied.
- Unknown construction data must remain visible; an empty material list must not be labeled ready when quantities are unavailable.

### Shared interactions

- A check means **Have enough for this build**. Unchecking reverses it immediately.
- Show **Still needed** and **All items** views; keep a visible way to restore completed rows.
- Use **Supplies ready**, never **Habitat built** or **House completed**, when all known required shopping rows are checked.
- Allow **Reset checks** with an undo action. Allow removing a habitat shopping list with undo; starting it again begins unchecked.
- Completed lists remain available until the player removes or resets them.
- Keep habitat lists and the house plan independent, even when they need the same item. No global combined total in this release.
- Keep item reference links usable separately from checkbox toggles, including on mobile and with a keyboard.

## Progress and changing requirements

[Likely] Use these rules to avoid false completion:

- Store checklist progress in a separate optional, versioned `shoppingChecklists` field in `SaveState`. Existing backups without it load as empty checklist progress.
- Give each habitat list a persistent build ID and source reference. Give the accepted house plan a persistent checklist identity; do not use `updatedAt`, array positions or reusable generated home IDs as its identity.
- Persist requirement snapshots and checked row signatures. Signatures include section, stable item identity (or conservative source-text fallback), required quantity and relevant source identity.
- Preserve checks only for unchanged requirements. A quantity increase or decrease resets that row with a visible **Requirements changed — check again** notice. New rows start unchecked; removed requirements no longer count.
- For house rows, include the contributing home/kit identities in the signature. Replacing a home must not reuse a tick solely because its new aggregate happens to match the old total.
- Reordering a list or editing unrelated display information must preserve checks.
- Applying an entirely regenerated house plan starts fresh house checks. Canceling a draft leaves the saved plan and its checks intact. Manual edits reconcile only affected rows.
- Catalog changes retain the saved context, identify changed requirements and require review. Missing source records remain visible as unavailable; never silently drop the whole list or mark it ready.
- Do not infer checkmarks from `materialCounts`, and do not change owned counts when checking a row. Preserve existing quantity data and backups; replace the habitat count-entry controls with checklist actions in this flow.
- Save through the existing progress provider; disable edits until loading completes and retain visible save-failure feedback.
- Extend backup validation and round trips for list identities, row signatures, snapshots and checked state. Reject malformed structures. Preserve valid snapshots whose source has since disappeared as needing review.

## Implementation sequence

[Likely] Implement in these bounded stages; leave each unchecked until verified.

### 1. Requirement model and persistence

- [ ] Audit real habitat requirements and shared habitat IDs, including ambiguous, quantity-free and non-item examples.
- [ ] Define habitat and house checklist identities, normalized rows, source snapshots and reconciliation rules.
- [ ] Reuse current parsers and supply aggregation where suitable; avoid interpreting uncertain text as exact requirements.
- [ ] Add saved state, old-save defaults and backup validation without altering existing found Pokémon or legacy plans.
- [ ] Add focused tests for cross-list isolation, quantity/source changes, unknown requirements and backup compatibility.

### 2. Habitat flow

- [ ] Add start/open actions and checkbox rows beside existing habitat artwork.
- [ ] Separate shopping, setup guidance and unresolved requirements.
- [ ] Add the planner's active habitat Shopping lists section, including when no Pokémon are marked found and no house plan exists.
- [ ] Add progress, filters, reset/remove and undo.
- [ ] Replace habitat owned-count inputs while preserving stored counts.

### 3. House flow

- [ ] Convert Combined supplies to the saved house checklist with independent construction and furnishing progress.
- [ ] Link from individual home details to the combined list.
- [ ] Reconcile manual home edits and isolate draft previews from saved checks.
- [ ] Ensure unknown kit quantities cannot produce a false ready state.

### 4. Verification

- [ ] Test that a shared item in two habitat lists and the house list has three independent check states.
- [ ] Test unchanged rows, altered quantities, home replacement, catalog changes and regenerated/canceled plans.
- [ ] Test old backups, new backup round trips, malformed checklist data and unavailable source records.
- [ ] Run relevant existing tests and the production build.
- [ ] Verify in-browser on desktop and narrow mobile: start habitat list → tick → reopen in planner → reload → untick.
- [ ] Verify house flow: tick totals → change home → inspect resets → preview replacement → cancel → confirm saved checks survive.
- [ ] Verify export/import preserves progress; verify a storage failure never appears as a successful save.
- [ ] Verify touch targets, keyboard checkboxes, item links, empty states and Still needed filtering.

## Acceptance criteria

[Likely] The feature is complete when a player can:

1. Start a checklist for one chosen habitat and find it again from the planner.
2. Check off house construction materials and optional furnishing suggestions using existing totals.
3. Keep progress after reload and backup restoration without entering inventory quantities.
4. See exactly which requirements still need gathering or review.
5. Change a build without silently carrying incompatible checks forward.
6. Finish shopping without the app claiming the habitat or house has been built.

## Deferred scope

[Likely] Defer OCR, voice parsing, inventory management, storage boxes, automatic consumption, recipe expansion, cross-build material allocation, partial quantities, multiple copies of a habitat, cloud synchronization and a new standalone shopping navigation page. Validate whether people actually return to these lists before expanding the feature.
