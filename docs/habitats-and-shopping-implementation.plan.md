# Habitats browser, build records and quantity shopping lists

Date: 9 September 2026
Status: Phase 1–5 implemented in code; Phase 6 browser verification pending.

## Direction and authority

[Certain] The requested direction is a third sidebar entry for Habitats, a searchable habitat catalog with fast region filters, planned/built states, location and copy counts, a full habitat view with possible Pokémon, and accessible habitat and house shopping lists.

[Likely] The specifications below are implementation defaults based on that discussion. They replace the checkbox-only direction, the habitat-list placement in Housemates, and the single-copy restriction in `shopping-checklist-plan.md`. They do not authorize deployment or mark any implementation complete.

[Likely] Product objective: **Choose a habitat, prepare its supplies, record where it is built, and see which Pokémon are still worth looking for there.** Keep gathering progress scoped to planned builds.

## Current source and gaps

[Certain] Current source inspected for this plan:

- `src/App.tsx` routes Pokédex, Pokémon details and Housemates using hash routes; active navigation currently distinguishes only planner versus dex.
- `src/catalog/types.ts` stores habitats under individual Pokémon. A habitat has an ID, image, requirements, source, areas, rarity, times and weather; there is no dedicated build-record model.
- `src/shopping/checklists.ts` stores boolean rows. Habitat identity includes Pokémon ID; row identity includes array position and quantity. House list identity uses plan creation time.
- Habitat shopping rows currently require a resolved catalog item and positive numeric quantity. Requirements that fail that test disappear from shopping calculations.
- `src/dex/DexPage.tsx` starts and checks habitat lists alongside requirement cards.
- `src/planner/PlannerPage.tsx` includes habitat-list links inside the house supply section and renders the combined house checklist. This couples habitat access to the house planner.
- `src/persistence/store.ts` validates existing notebook and shopping fields. Its current shopping structure has no explicit format version.

[Likely] Treat existing code as a partial foundation. Replace fragile identities and boolean progress, preserve existing notebook data, and do not carry the earlier completion claims forward as proof of this redesign.

## 1. Navigation and routes

[Likely] Implement:

- Sidebar order: **Pokédex · Habitats · Housemates**. Habitats is the new third feature, positioned between discovery and housing.
- `#/habitats`: habitat catalog.
- `#/habitats/:habitatId`: full habitat detail.
- Preserve all current Pokémon and housemate links.
- Explicitly resolve route families for sidebar selection and breadcrumbs. A habitat route must not highlight Pokédex.
- Preserve habitat search, region, status and sorting in route query parameters; browser Back restores the previous browsing state.
- Make invalid/deleted habitat routes recover gracefully with a link to the catalog.
- Link each habitat card in Pokémon details to the full habitat page. Starting a build from either place reaches the same build records.

## 2. Canonical habitat catalog

[Likely] Create a deterministic derived index over the existing pinned catalog before considering an importer schema change.

- One canonical habitat entry per verified habitat identity, independent of Pokémon ID.
- Audit shared IDs, source URLs, names and requirement sets across all habitat associations. Produce counts of distinct habitats, duplicate associations, identity collisions and conflicting fields.
- Prefer a consistent source habitat ID/URL. Do not merge by display name alone or create a fresh habitat because requirement order changed.
- Preserve the Pokémon–habitat association as its own record, including regions, rarity, times and weather. Conditions may vary between associated Pokémon.
- Union regions only for catalog discovery. Detail filtering must consult each association's own conditions, rather than claiming all Pokémon appear in every unioned region.
- Use existing fallback behavior only where the current catalog contract supports it; label inherited Pokémon-level conditions. Missing data remains unknown.
- Keep original requirements and source references alongside normalized shopping rows and setup guidance.
- Conflicting identity or requirement evidence produces a visible review state; do not silently pick whichever association appears first.
- Define possible-Pokémon counts as distinct catalog Pokémon entry IDs, consistent with existing discovery tracking; disclose that separately tracked forms may be separate entries. Deduplicate repeated associations.
- Never imply a Pokémon is guaranteed to spawn or invent encounter rates.

## 3. Habitat catalog page

[Likely] Reuse the established Pokédex visual language while keeping habitat-specific controls.

### Cards

- Habitat image, name and number of possible Pokémon.
- Text status badges: **Not started**, **Planned**, **Built**.
- Grey/muted badge for no records, yellow for planned builds, green for built copies. Keep images legible and cards clickable.
- Mixed state shows both quantities, for example **2 built · 1 planned**. Do not compress it to a single misleading status.
- Clicking image/title opens detail. Separate **Plan build** and **Record built** buttons perform their named actions without also triggering card navigation.
- Count built/planned copies, not record rows. A record with three copies counts as three.

### Filters

- Search by habitat name or associated Pokémon name.
- Fast region chips, default **All regions**; use one selected region for the initial release.
- Status: **All · Not started · Planned · Built**. Mixed entries match both Planned and Built; Not started means neither exists.
- **Can attract Pokémon I haven't found** toggle, using current found records and the selected encounter region.
- Explicit region mode: **Available here** by default; **My builds here** for filtering recorded/planned locations. Never silently switch semantics.
- Sort: habitat name by default; additional **Most unfound Pokémon** option. Stable tie-break by canonical ID.
- Show result count, active filters and Clear filters. Preserve filters when returning from detail.
- If references lack a region, do not treat it as availability in all regions. Retain discoverability under All regions with **Region not recorded**.
- Display an informative no-results state; distinguish it from an empty user build history.

## 4. Habitat detail page

[Likely] Present information in this order:

1. Habitat image, name, sources and recorded availability.
2. **Plan build** / **Record built** actions and own build summary.
3. Required supplies, setup/placement instructions and unresolved requirements.
4. **Pokémon that can appear here**, with recorded encounter conditions.
5. **Your builds**, grouped by region and optional location note.

- Possible Pokémon remain visible before and after building; they inform the decision to build.
- Each Pokémon links to its existing detail page and shows found/not-found state from the notebook.
- Offer **All possible · Not found yet** within the Pokémon section. After recording a build, bring attention to unfound Pokémon without hiding the full list.
- When opening a recorded location, use its region to filter supported encounter associations and label the active region.
- A built habitat does not mark Pokémon found. Found status does not prove the encounter occurred at a recorded build.
- Display rarity/time/weather per Pokémon association where needed, rather than imposing one condition on every Pokémon.
- Keep unknown and conflicting data visibly distinct from empty results.

## 5. Build records and lifecycle

[Likely] Model a habitat definition separately from a player's physical builds.

### Build record fields

- Persistent random `id`, canonical `habitatId`, `status: planned | built`, `region`, positive integer `copies`, optional `locationNote`, timestamps.
- Snapshot of habitat name, source identity, normalized requirements and catalog version for reconciliation and unavailable references.
- Per-requirement gathered quantities for planned records only, with stable requirement identity and accepted requirement signature.
- `region: null` is allowed for migrated records only; show **Choose a region**. New records require region selection.
- A record represents copies of one habitat at one described location. Different regions or locations use separate records.
- Do not store a global habitat status; derive card badges from records.

### Actions

- **Plan build:** choose region, copies (default 1), optional note; create unchecked/zero-gathered requirements multiplied by copies.
- When an active plan exists, show **Open planned build** and a clear **Plan another location** option. Prevent duplicate submission; do not auto-merge separately intended builds.
- **Record built:** record an existing build without requiring shopping history or fabricating gathered quantities.
- **Mark built:** convert a planned record explicitly; completed supplies never trigger this automatically.
- Allow marking built even when shopping is incomplete, since the player may have gathered items outside the app. Explain that this removes the corresponding planned requirements from active shopping.
- When only some copies are complete, ask **How many did you build?** Split the record into built copies and remaining planned copies.
- Edit location note/region without resetting supply quantities; refresh encounter information for the selected region.
- Increase planned copies: retain gathered amounts and increase requirements. Decrease copies: clamp allocated amounts to the new requirement and show released amounts in the undo feedback.
- Cancel a planned build or remove a built record with Undo. Removing a built record does not automatically create a shopping plan or imply the physical habitat was demolished.
- First release does not offer a general “convert built back to planned” toggle. Use Plan build for another build; use Undo to correct a recent accidental completion.

## 6. Quantity shopping and allocation

[Likely] Store allocations on planned builds; derive the combined list. This makes shared-item totals consistent without maintaining a global inventory.

### Per-build rows

- Display **Glass: 5 / 10 · Need 5 more**.
- Gathered quantity is an integer from zero through that build's required amount. Empty edit input is temporary, never persisted as NaN; commit a valid value on blur/Enter.
- Provide an editable number, minus/plus controls and **Have all** shortcut. Provide **Reset gathered** with Undo.
- Explain once: **Gathered means set aside for these builds.** It is not automatically synchronized with game storage.
- `remaining = max(required - gathered, 0)`. A row is ready when gathered reaches required; no independent boolean can disagree with the number.
- Keep unresolved requirements outside numeric totals and block an unconditional Supplies ready claim while required shopping evidence is missing.
- Known category requirements such as “any seat” may be checkable with a recorded quantity when their meaning is supported. Do not force a specific item or merge a category with one of its example items.
- Terrain, placement, time and weather remain setup/reference information. Unknown items are **Needs review**, never automatically reclassified as terrain.

### Combined habitat list

- Aggregate only active planned habitat records, with quantities multiplied by copies.
- Group exact item identities together. Keep variants/categories distinct unless equivalence is explicitly supported; retain build-level provenance and original text.
- Combined required and gathered values are sums of per-build allocations. Expanding an item shows which builds need it and each build's allocation.
- Editing a combined total redistributes only the change: additions fill unmet requirements in stable creation order, removals release allocations in reverse order. Display **Applied to oldest plans first; adjust per build below**.
- Allow direct per-build allocation changes from the expanded row. Use the same state update path in both views.
- Example: A needs 10 glass and B needs 5. Entering 5 gathered produces A=5, B=0, total remaining=10; it must never produce five gathered in each build.
- Marking A built removes A's requirement and its allocated quantities from the active list. B's allocation is unchanged; consumed allocations never transfer automatically to B.
- Partial completion of N out of M copies removes `min(gathered, perCopyRequired × N)` from that record's gathered amounts; remaining allocation is clamped to remaining demand. Show the effect with Undo, and do not claim this is observed game consumption.
- Canceling a plan releases its allocation but does not assign it elsewhere. The player can enter those materials against another plan.
- Filters: **Still needed · All items**, plus optional planned-build selection. Counts and totals always describe the selected scope.

### House list

- Replace boolean rows with gathered quantities using the same row controls and calculation rules.
- Keep construction and optional furnishings separate. Furnishing completion does not block construction readiness.
- Preserve house-only scope and preview isolation. Provide a persistent accepted-plan ID rather than timestamp identity.
- Unchanged requirement identity retains gathered amounts after manual edits; increased demand preserves the amount and exposes the new shortage. Reduced demand clamps the amount with feedback.
- Changes to contributing homes/kit identities require review of affected allocations, even if an aggregate total happens to match. Do not silently reset every unrelated item.
- A regenerated accepted house plan starts a new list, with Undo for the replacement; canceled drafts preserve saved quantities.
- Do not add house construction-completion tracking in this iteration. The house list reports supplies readiness only.
- Habitat and house gathered totals remain independent; disclose that the same physical materials should not be entered as allocated to both.

## 7. Floating checklist access

[Likely] Use one labelled floating button per relevant route family:

- Pokédex and Pokémon details: **Habitat list**.
- Habitat catalog and detail: the same **Habitat list**.
- Housemates: **House list** only.
- Habitat badge counts active planned copies; accessible label explains that unit. House badge counts construction material types still needed, using a different descriptive label.
- Keep access visible with an empty state explaining how to start. Clicking opens a side panel on desktop and a sheet on mobile; it does not require a new sidebar destination.
- Preserve background page/filter/scroll state on close. Return focus to the trigger; support Escape and keyboard navigation.
- Hide the floating trigger behind active dialogs, respect mobile safe areas and keep minimum 44px touch targets. Icon plus short text avoids an ambiguous basket icon.
- Remove habitat-list content from Housemates once habitat list access is available and migration is verified.

## 8. Persistence, migration and reconciliation

[Likely] Introduce a versioned habitat-build/quantity-shopping payload with pure migration and validation helpers.

- Preserve discoveries, `materialCounts`, legacy spatial plans and the housemate plan. Existing material counts must not auto-populate build allocations.
- Migrate checkbox true to that old row's required quantity, false to zero, only where the old row maps confidently to an unchanged requirement.
- Preserve original shopping data in a legacy migration snapshot inside the notebook until the user has a verified export. Migration must be idempotent and must not duplicate builds on reload.
- Old Pokémon-scoped habitat lists have no location. Import them as planned records with **Choose a region**, retaining their origin Pokémon and progress.
- If two old lists map to one canonical habitat, retain both as separate records marked **Review imported copies**. Never silently merge checked quantities or discard one.
- Missing or ambiguous row mappings retain their original snapshot in Needs review with no fabricated quantity allocation.
- Use stable IDs independent of array order, quantity and labels. Keep a separate signature for accepted quantity, variant and source changes.
- On catalog changes, preserve the accepted snapshot, show the requirement differences and reconcile after the player accepts them. Block unconditional readiness while unresolved changes exist.
- Preserve unavailable-source build records and user notes; display their last saved snapshot and a source-unavailable notice.
- Reject malformed versions, duplicate record IDs, invalid references between internal records, non-integer/negative/overflow counts and gathered values beyond required quantities. Catalog disappearance alone must not invalidate an otherwise valid user snapshot.
- Backups must round-trip new and legacy payloads. Loading an old notebook supplies empty defaults without altering unrelated fields.
- Use the existing save queue and visible save errors. Never display successful persistence solely because a checkbox or input changed on screen.

## 9. Suggested code boundaries

[Likely] Suggested files; implementation may consolidate small helpers where clearer:

| Area | Responsibility |
| --- | --- |
| `src/habitats/catalog.ts` | Canonical habitat index, association-level encounter data, conflict detection |
| `src/habitats/types.ts` | Habitat views and persistent build records |
| `src/habitats/search.ts` | Search, region/status filters and stable sorting |
| `src/habitats/HabitatsPage.tsx` | Catalog cards and browsing state |
| `src/habitats/HabitatDetail.tsx` | Requirements, encounters, own builds |
| `src/habitats/builds.ts` | Create/edit/split/complete records as pure transitions |
| `src/shopping/checklists.ts` | Replace boolean logic with normalized requirements and quantity reconciliation |
| `src/shopping/ShoppingPanel.tsx` | Shared quantity controls, scoped lists, provenance and filters |
| `src/shopping/ChecklistFab.tsx` | Route-aware, labelled floating entry point |
| `src/persistence/store.ts` | Format validation and backup handling |
| `src/progress/context.tsx` | Atomic persisted updates, migration integration, undo application |
| `src/App.tsx` | Explicit navigation, routes, breadcrumbs and panel integration |
| `src/dex/DexPage.tsx` | Canonical habitat links and shared build actions |
| `src/planner/PlannerPage.tsx` | House quantity list integration and habitat section removal |

## 10. Delivery sequence

[Likely] Finish and verify each slice before moving on. These boxes describe future work.

### Phase 1 — Audit and contracts

- [x] Audit habitat identities, shared associations, source conflicts and requirement classifications against the pinned catalog.
- [x] Define canonical identity, distinct-Pokémon count semantics, build records and quantity allocation rules.
- [x] Implement pure normalizers, transitions and migration with representative fixtures.
- [x] Verify old-save preservation and idempotent migration before replacing UI entry points.

### Phase 2 — Habitat discovery

- [x] Add sidebar entry, routes, catalog cards, region chips, search, statuses and unfound-Pokémon filter.
- [x] Add full detail with source-backed encounter associations and existing habitat images.
- [x] Link from Pokémon details and preserve Back/filter state.
- [ ] Browser-check initial and empty states on desktop and mobile.

### Phase 3 — Own builds

- [x] Add Plan build and Record built forms with region, copies and location note.
- [x] Add planned/built summaries, mixed badges, edits and removal with Undo.
- [x] Add explicit complete/partial-complete transitions and reconciliation notices.
- [ ] Verify location-specific encounter display and saved build counts after reload.

### Phase 4 — Habitat shopping

- [x] Add per-build partial quantities, Have all, Still needed filter and reset with Undo.
- [x] Add combined list with stable allocation and expandable contribution rows.
- [x] Add Habitat list floating access in both route families, including empty state.
- [x] Remove old habitat checklist placement from Housemates.

### Phase 5 — House shopping

- [x] Introduce durable house list identity and migrate boolean progress.
- [x] Reuse quantity controls while retaining separate construction/furnishing totals.
- [x] Add House list floating access and preserve draft preview isolation.
- [ ] Verify requirement-change handling and regenerated-plan behavior.

### Phase 6 — Release verification

- [x] Run relevant tests, TypeScript checks and production/offline build with the supported modern Node runtime.
- [ ] Complete the browser acceptance scenarios below, including narrow mobile layout.
- [x] Update this document with actual completed phases, test results and remaining limitations. Never mark unchecked work complete from a passing build alone.

## 11. Required acceptance scenarios

[Likely] Automated tests should exercise meaningful state transitions and data conflicts:

1. Two Pokémon share one habitat: one catalog card, two supported associations; different regional encounter rules remain distinct.
2. One habitat has two built copies in A and one planned copy in B: mixed badges, correct counts and independent region filters.
3. Glass requirement 10, gathered 5: Need 5 more in detail and combined view, still correct after reload/export/import.
4. Two plans need 10 and 5 glass: setting combined gathered to 5 allocates exactly five total; completing/canceling one never credits the other.
5. Three planned copies become one built plus two planned: required and gathered quantities follow the defined split rule; Undo restores exact prior state.
6. Record built with no shopping history: a built record appears without invented material progress or found Pokémon.
7. Legacy checkbox lists migrate once, preserve ambiguous duplicates and unknown regions, and retain unrelated notebook data.
8. Requirement reorder preserves progress; quantity/source changes trigger the intended reconciliation; unavailable references remain inspectable.
9. House draft preview and cancel leave saved quantities untouched; a regenerated accepted plan gets a fresh identity.
10. Malformed backups fail clearly; new backups restore all counts, notes, statuses and preserved legacy snapshots.

[Likely] Verify the actual player flow in-browser:

- Search/filter habitats → open detail → plan two copies in a region → enter partial supplies → reopen through the floating button → reload → complete one copy.
- Record a second location, inspect mixed badges and filter Available here versus My builds here.
- View possible Pokémon before building and unfound Pokémon afterward; no automatic discovery changes.
- Open/reset/remove/undo and navigate Back without losing filters or trapping focus.
- Open habitat list with no found Pokémon and no house plan; open house list with no planned houses.
- Verify keyboard controls, 390px mobile layout, no horizontal overflow, safe-area spacing and no obscured content.
- Verify persistence failure feedback using a controlled test fixture; backup round trip must preserve a known quantity and build record.

## Out of scope

[Likely] Defer OCR, global inventory/storage management, cloud sync, automatic game state detection, map placement, recipe expansion, exact spawn probabilities, automated discovery marking and cross-allocation of materials between habitat and house lists. None is needed to make the requested partial-quantity shopping and habitat browser useful.
