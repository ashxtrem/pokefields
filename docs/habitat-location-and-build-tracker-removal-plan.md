# Habitat Location Tracking and Build-Tracker Removal Plan

**[Certain] Status:** Implemented in code (Phases 0–5). `npm test`, `npm run build:web`, and `npm run build:android:web` all pass. Browser/device acceptance checks (§10.2–§10.4) still require manual verification; they were not run as part of this implementation pass.

**[Certain] Last updated:** 2026-09-24 (code audit and decision round; see §14).

**[Certain] Scope:** Remove habitat planning, habitat material progress, Housemates material progress, both floating checklist entry points, and their active persistence. Replace habitat “built” tracking with a lightweight record of where an already-built habitat exists. Keep requirement and material knowledge as read-only reference content, and use Storage search to locate items.

**[Certain] Distributions:** The change ships identically in the web build and the Android (Capacitor) build. Both use the same `src/` code, the same notebook schema, and the same backup format. §7 lists the Android-specific contract.

**[Certain] Visual reference:** [`docs/mockups/habitat-location-card.html`](./mockups/habitat-location-card.html). Its habitat names, locations, and counts are illustrative UI content, not catalog rules. Its “Why this stays lightweight” aside is design rationale, not shipped UI.

**[Certain] Superseded scope:** This plan supersedes the habitat build lifecycle and habitat/house checklist portions of [`docs/habitats-and-shopping-implementation.plan.md`](./habitats-and-shopping-implementation.plan.md) and [`docs/shopping-checklist-plan.md`](./shopping-checklist-plan.md). Those files remain historical context until implementation and documentation cleanup are complete.

## 1. Product decision

### 1.1 Locked outcomes

- **[Certain]** The app will no longer let a player plan a future habitat build.
- **[Certain]** The app will no longer track gathered or remaining materials for habitats.
- **[Certain]** The app will no longer track gathered or remaining materials for Housemates homes.
- **[Certain]** The habitat and Housemates floating action buttons will both be removed; there will be no replacement FAB.
- **[Certain]** Habitat requirements remain visible as reference knowledge.
- **[Certain]** House construction materials, furnishing suggestions, and environment guidance remain visible as reference knowledge.
- **[Certain]** Every catalog-backed item reference leads to the existing Storage search through one `Find in Storage` link in the shared item explain popup (`ExplainDialog`), so habitat requirements, Pokémon habitat cards, Housemates rows, and Home detail all gain it from one change.
- **[Certain]** A habitat can be recorded only after it has been built, using a lightweight location record.
- **[Certain]** The active named region filter is the default destination for a new habitat location.
- **[Certain]** Saving a habitat in that selected named region takes one action.
- **[Certain]** A landmark or free-text note is optional and may be added after the quick save.
- **[Certain]** A count greater than one is optional and represents multiple copies at one physical spot.
- **[Certain]** Separate physical spots remain separate location rows, even when they share a region.
- **[Certain]** The Housemates “home built and Pokémon moved in” completion mark remains. It records an outcome, not material gathering.
- **[Certain]** Old build and house-shopping data is moved into clearly named legacy snapshot fields and is never shown again; it survives export/import.

### 1.2 Why the distinction matters

- **[Certain]** The current Housemates completion checkbox explicitly means “Home built and Pokémon moved in” in `src/planner/PlannerPage.tsx:994-1007` and `src/planner/types.ts:32-38`.
- **[Likely]** Removing that completion state together with material tracking would discard useful relocation progress and would exceed the decision to remove the material tracker and FAB.
- **[Certain]** Storage is presence-based and can answer which recorded chests contain an item; the route helper already supports a prefilled query at `src/storage/search.ts:68-70`, and Item detail already links to it at `src/items/ItemDetail.tsx:204`.
- **[Likely]** A read-only requirement list plus direct Storage lookup provides more useful information than a second, manually synchronized gathered-count system.

## 2. Current-state evidence

| Confidence | Current behavior | Evidence |
| --- | --- | --- |
| **[Certain]** | Habitat state models planned/built status, requirement snapshots, gathered allocations, copies, region, and notes. The habitat name lives at `snapshot.habitatName`. | `src/habitats/types.ts:3-45` |
| **[Certain]** | Habitat cards expose “Plan build” and “Record built.” | `src/habitats/HabitatsPage.tsx:223-249`, `src/habitats/HabitatsPage.tsx:310-326` |
| **[Certain]** | Habitat detail exposes build status, planning, recording, material progress, splitting, and deletion. Location note edits write on every keystroke through `update`. | `src/habitats/HabitatDetail.tsx:154-258`, `src/habitats/HabitatDetail.tsx:346-356` |
| **[Certain]** | Pokémon detail repeats planned/built state and a “Plan build” action. | `src/dex/DexPage.tsx:596-647`, `src/dex/DexPage.tsx:744-756` |
| **[Certain]** | The region selector is a single choice: All regions (`""`), one catalog region, or Region not recorded (`"__none__"`). It is not an OR or multi-region filter. | `src/habitats/HabitatsPage.tsx:116-140` |
| **[Certain]** | Under “Available here,” Region not recorded filters the catalog to habitats that have no discovery region in the catalog data. It is not only a user-record state. | `src/habitats/search.ts:118-119`, `src/habitats/catalog.ts:56` |
| **[Certain]** | Under “My builds here” with All regions, no build filter is applied at all, so every habitat is listed. | `src/habitats/search.ts:83-109` |
| **[Certain]** | Advanced filters currently include build status and “Available here / My builds here.” | `src/habitats/HabitatsPage.tsx:142-175` |
| **[Certain]** | The FAB routes to habitat or house checklists and displays active-plan/remaining-material badges. | `src/shopping/ChecklistFab.tsx:8-24`, `src/shopping/ChecklistFab.tsx:79-87` |
| **[Certain]** | Saving a Housemates plan currently regenerates and persists a gathered-quantity list. | `src/planner/PlannerPage.tsx:187-197` |
| **[Certain]** | Changing a town environment level also regenerates `houseShopping`. | `src/ui/components.tsx:349-364` |
| **[Certain]** | The planner labels the reference section as a shopping checklist and renders rows from `houseShopping`, not from the supply calculation. A draft plan therefore shows empty rows because `houseShopping` is `null` while drafting. | `src/planner/PlannerPage.tsx:237-245`, `src/planner/PlannerPage.tsx:740-796`, `src/planner/PlannerPage.tsx:877-916` |
| **[Certain]** | The notebook blob currently stores habitat builds, house shopping, legacy shopping, and a legacy material-count map. | `src/persistence/store.ts:23-56`, `src/persistence/store.ts:57-67` |
| **[Certain]** | Load normalization regenerates planned builds from boolean habitat checklists whenever `habitatBuilds` is empty, and regenerates `houseShopping` from the old house checklist. | `src/habitats/migration.ts:98-115`, `src/progress/context.tsx:55-86` |
| **[Certain]** | Import does not run load normalization: `validateBackup` only validates, and `replaceNotebook` persists as-is. The import preview counts come from the unmigrated payload. | `src/persistence/store.ts:93-224`, `src/progress/context.tsx:182-191`, `src/App.tsx:515-549` |
| **[Certain]** | Existing notebook writes are optimistic; the UI state changes before IndexedDB confirms the write, and `updateWithUndo` returns nothing. | `src/progress/context.tsx:122-167` |
| **[Certain]** | Undo is one global stack shown as a banner. An entry without `fields` restores the whole previous notebook, which would revert unrelated later changes. Scoped fields exist only for `crafting`, `materialCounts`, and `collected`, and a scoped undo refuses when that field changed later. | `src/crafting/undo.ts:9-88`, `src/App.tsx:314-326` |
| **[Certain]** | `ExplainDialog` already resolves a catalog item for item terms and renders a “View recipe” link. | `src/ui/components.tsx:425-545` |
| **[Certain]** | Storage search is a normalized substring match over item names, so a prefilled query also lists items whose names contain it. | `src/storage/search.ts:13-32` |
| **[Certain]** | Code outside the plan's original change map depends on tracker modules: `src/ui/components.tsx` (house list), `src/items/requiredBy.ts` (`normalizeRequirements`), `src/habitats/HabitatDetail.tsx` and `src/dex/DexPage.tsx` (`SupplyIcon` from `src/shopping/`), `tests/habitats.test.ts`, and `tests/core.test.ts`. `useHouseShoppingUpdate` has no callers. | `rg` over `src` and `tests` |
| **[Certain]** | Web and Android share all feature code; the only switch is `VITE_DISTRIBUTION`, read through `src/platform/distribution.ts`. Android backup export goes through the share sheet (`src/platform/backupExport.ts`); import uses the same `validateBackupEnvelope`. | `src/platform/*.ts`, `src/App.tsx:205-227`, `.env.android` |
| **[Certain]** | The Android catalog keeps habitat IDs, names, and `areas` but blanks every `source` field, so migration and location records must not depend on habitat source URLs. | `scripts/build-android-catalog.mjs:29-57` |
| **[Certain]** | The Android build packages `public/privacy.html` for offline reading, and the release contract requires the hosted policy, the packaged copy, and Play Data safety answers to agree. | `scripts/verify-android-assets.mjs:89-90`, `docs/android-release-contract.md` (“Locked Android v1 product declarations”) |
| **[Certain]** | `verify-android-output.mjs` fails the Android build on any unexplained remote URL in `dist-android/`. | `scripts/verify-android-output.mjs:38-75` |
| **[Certain]** | The Android Back contract (close topmost modal → leave edit state → previous route) is specified but not implemented: no `@capacitor/app` listener exists in `src/` yet. | `docs/android-play-store-release-plan.md` §5.2, `rg "@capacitor/app" src` |
| **[Certain]** | Android v1 (`1.0.0` / code `1`) has not been released to Play; Play app creation is still blocked. | `docs/android-release-contract.md` (“Native project state”) |
| **[Certain]** | The Android release plan's offline and device test matrices still list “checklists” as data to create and persist. | `docs/android-play-store-release-plan.md:280`, `docs/android-play-store-release-plan.md:483` |
| **[Certain]** | Public copy describes the removed system: the Habitats hero (“prepare its supplies… plan builds”), the Habitats empty state (“build history”), the notebook intro, and the privacy page (“checklist progress”, “habitat builds”). | `src/habitats/HabitatsPage.tsx:80-88`, `src/habitats/HabitatsPage.tsx:217-220`, `src/App.tsx:383`, `public/privacy.html:85-86` |

## 3. Target experience

### 3.1 Habitat catalog filter semantics

- **[Certain]** Keep the current single-select region chip row.
- **[Certain]** Keep `All regions` as the default browsing state.
- **[Certain]** Keep every named catalog region as a mutually exclusive selection.
- **[Certain]** Do not add multi-select or OR behavior; that would make the save destination ambiguous.
- **[Certain]** Replace the existing `Available here / My builds here` mode with `Available here / Saved here`, keeping it in the advanced filter panel.
- **[Certain]** Remove the `Not started / Planned / Built` status filter.
- **[Certain]** `Region not recorded` keeps a meaning in both scopes:
  - Under `Available here`, it lists habitats whose catalog data has no discovery region (today's behavior).
  - Under `Saved here`, it lists habitats that have at least one migrated location with `region: null`.
- **[Certain]** `Saved here` with `All regions` lists every habitat with at least one saved location. This fixes today's behavior of listing everything.
- **[Certain]** `Saved here` with a named region lists habitats with at least one location in that region.

### 3.2 Catalog card action matrix

| Confidence | Scope | Active region | Existing saved location | Primary card action | Result |
| --- | --- | --- | --- | --- | --- |
| **[Certain]** | Either | Named region | None in that region | `Save in {Region}` | One action creates a region-only location with count `1` and no note. |
| **[Certain]** | Either | Named region | One or more in that region | `✓ Saved here` | Opens habitat detail at `#my-locations`; it does not create a duplicate. |
| **[Certain]** | Either | All regions | Any | `Choose location` | Opens the compact region picker, then saves immediately after selection. If the chosen region already has a location for this habitat, it opens habitat detail at `#my-locations` instead of saving. |
| **[Certain]** | Available here | Region not recorded | Any | `Choose location` | Same as All regions. These are catalog habitats without discovery-region data. |
| **[Certain]** | Saved here | Region not recorded | Migrated `region: null` record | `Review location` | Opens that record in edit mode on habitat detail so the player can choose a real region. |

- **[Certain]** The sentinels `""` (All regions) and `"__none__"` (Region not recorded) can never be written as a location region.
- **[Certain]** The compact region picker lists all catalog towns. Towns in the habitat's `discoveryRegions` come first, then the rest, each group alphabetical.
- **[Certain]** Quick save uses the selected region without reopening a full form.
- **[Certain]** Quick save guards against accidental duplication by checking `habitatId + region` before creating a record.
- **[Certain]** Intentional additional spots use `Add another location` on habitat detail and may share a region with another row.
- **[Certain]** The catalog card shows a compact `1 saved location` or `{n} saved locations` summary instead of planned/built status. Counts are location rows, not summed copies (the mock shows `2 saved` for rows with 2 and 1 copies).
- **[Certain]** The catalog does not show full landmark rows; those belong on habitat detail.

### 3.3 Quick-save feedback

- **[Certain]** Immediately after activation, change the card action to a disabled `Saving…` state until the write settles, so a double click cannot enqueue a duplicate. The duplicate guard in §3.2 is the second line of defense.
- **[Certain]** After IndexedDB confirms the write, the card shows `✓ Saved here` plus an `Add landmark` action, and a polite live region announces `Saved {Habitat} in {Region}`.
- **[Certain]** `Add landmark` opens habitat detail, scrolls to `#my-locations`, and opens the new row in edit mode with its note field focused.
- **[Certain]** Undo is the existing global undo banner, labelled `Saved {Habitat} in {Region}`. It is scoped to a new `habitatLocations` undo field, so it removes only location changes and never reverts unrelated notebook changes. If a later location edit is in the way, it refuses with the existing “a later change … is in the way” message.
- **[Certain]** If persistence fails, do not announce success. The record stays in memory, and so in any export. The live region announces `Not saved to this device. Export a backup to keep it.`, and the existing global `Not saved` error remains. No separate retry mechanism is added: the next successful notebook write persists the whole state, including this record.
- **[Certain]** `updateWithUndo` (and `update`) return a `Promise<boolean>` that resolves `true` once that write is confirmed and `false` when it fails or when the notebook is not ready. No second storage pathway is created.

### 3.4 Habitat detail: “My locations”

- **[Certain]** Keep the habitat image, source/reference facts, possible Pokémon, and required supplies. Required-supply item buttons gain `Find in Storage` through `ExplainDialog` (§3.7).
- **[Certain]** Remove the build status block, `Plan build`, `Record built`, `Open planned build`, partial completion, allocation controls, and “Your builds.”
- **[Certain]** Add a `My locations` section (`id="my-locations"`) based on the approved mock: heading, “Places where you built this habitat.”, an `{n} saved` pill, the rows, and an `Add another location` footer action.
- **[Certain]** Each row shows region, optional landmark/note, the copy count (`{n} here`), and an edit action.
- **[Likely]** Edit opens the row inline with region chips, note, count, `Save`, `Cancel`, and `Remove`. Edits are written once on `Save`, not per keystroke, so scoped undo is not blocked by typing.
- **[Certain]** Region is required for newly created records and must be one of the current catalog areas.
- **[Certain]** Note is optional, trimmed, and stored as an empty string when omitted.
- **[Certain]** Count defaults to `1` and must be a positive safe integer.
- **[Certain]** Adding and removing a row are undoable through the scoped undo field. Region/note/count edits are not undoable.
- **[Certain]** Changing a region into one already used by another row is allowed because two physical spots may be in the same region.
- **[Certain]** Review flags render on the row: `Choose a region`, `Habitat missing from catalog`, and `Possible duplicate`. Assigning a region clears `Choose a region`; saving or removing the row clears `Possible duplicate`.
- **[Certain]** The Pokémon chips use the catalog filter's named region only, no longer the first build's region.
- **[Likely]** The empty state should read: `No saved locations yet. Choose a region above or add one here.`

### 3.5 Pokémon habitat cards

- **[Certain]** Keep habitat identity, availability facts, requirements, and the link to habitat detail.
- **[Certain]** Remove planned/built labels and `Plan build`.
- **[Certain]** Show only the saved-location row count because Pokémon detail has no selected habitat-region filter to use as an unambiguous quick-save target.
- **[Likely]** If no location exists, omit the status line rather than replacing it with a negative `Not started` label.

### 3.6 Housemates reference and completion

- **[Certain]** Keep home grouping, resident movement, kit choice, material totals, furnishing suggestions, environment guidance, and the home completion checkbox.
- **[Certain]** Rename `House shopping checklist` to `What these homes need`.
- **[Certain]** Render rows directly from `combinedSupplies` and `environmentSupplies`, not from a stored list. Draft plans then show their reference rows too.
- **[Certain]** Replace every `gathered / required` display with a read-only `× quantity` display.
- **[Certain]** Item names stay as `ItemButton`s; `Find in Storage` comes from `ExplainDialog` (§3.7). A name that does not resolve to a catalog item gets no Storage link.
- **[Certain]** Remove all `Use the House list button`, `Still gathering`, `Have all`, increment/decrement, reset, badge-count, and gathered-progress copy.
- **[Certain]** Saving or editing a Housemates plan, and changing a town environment level, must no longer create or reconcile `houseShopping` state.

### 3.7 Storage handoff

- **[Certain]** `ExplainDialog` renders `Find in Storage` next to `View recipe` whenever the term resolves to a catalog item. It links to `storageSearchHref(catalogItem.name)` and closes the dialog on activation.
- **[Certain]** No link is shown for condition terms or unresolved item names.
- **[Certain]** Storage search is a substring match, so the prefilled results include the exact item plus any items whose names contain it. This is accepted; exact-match-first ranking is out of scope.

### 3.8 Copy updates

- **[Certain]** Habitats hero: replace “prepare its supplies” and “plan builds” with copy about browsing habitats and saving where you built them.
- **[Certain]** Habitats empty state: replace “This is not the same as having no build history.” with a reference to saved locations.
- **[Certain]** Notebook intro (`src/App.tsx:383`): replace “habitat builds” with “saved habitat locations.”
- **[Certain]** Privacy page (`public/privacy.html:85-86`): replace “checklist progress” and “habitat builds” with the current data (“saved habitat locations”), then rebuild the legal site. The same file is packaged into the Android build, so the offline in-app copy changes with it. Deploying the hosted legal site is a separate release step, and it must go out no later than the first Android build that contains this change (§7.5).

## 4. Active data model

### 4.1 Habitat location record

**[Certain] Active contract:**

```ts
export type HabitatLocationFlag =
  | "Choose a region"
  | "Habitat missing from catalog"
  | "Possible duplicate";

export interface HabitatLocationRecord {
  id: string;
  habitatId: string;
  habitatNameSnapshot: string;
  region: string | null;
  note: string;
  copies: number;
  createdAt: string;
  updatedAt: string;
  reviewFlags?: HabitatLocationFlag[];
}
```

- **[Certain]** `status`, requirements snapshot, allocations, gathered progress, and origin Pokémon do not belong in the new active record.
- **[Certain]** `region: null` is accepted only on records flagged `Choose a region`; new writes require a named catalog region.
- **[Certain]** `habitatNameSnapshot` comes from the catalog name on creation and from `snapshot.habitatName` on migration. It keeps an exported location understandable if a later catalog no longer contains its habitat ID.
- **[Certain]** `copies` describes copies at this row's physical spot, not a plan or quantity still to build.
- **[Certain]** Record IDs remain stable across edits. New IDs use one shared UUID helper (today `newBuildId` in `src/habitats/builds.ts` and `newUid` in `src/storage/types.ts` duplicate each other).
- **[Certain]** `updatedAt` changes on region, note, or count edits; `createdAt` does not.

### 4.2 SaveState changes

**[Certain] Fields:**

```ts
interface SaveState {
  habitatLocations?: Record<string, HabitatLocationRecord>;
  habitatLocationMigrationVersion?: 1;
  /** Verbatim former `habitatBuilds`; compatibility data only. */
  habitatBuildLegacySnapshot?: Record<string, LegacyHabitatBuildRecord>;
  /** Verbatim former `houseShopping`; compatibility data only. */
  houseShoppingLegacySnapshot?: LegacyHouseQuantityList;
  // Removed after migration: habitatBuilds, houseShopping
  // Unchanged legacy fields: shoppingChecklists, shoppingLegacySnapshot, materialCounts
}
```

- **[Certain]** `habitatLocations` becomes the only active habitat-tracking field.
- **[Certain]** Migration moves `habitatBuilds` and `houseShopping` into their snapshot fields and deletes the originals, so the data is stored once under a name that says it is inactive.
- **[Certain]** `shoppingChecklists`, `shoppingLegacySnapshot`, and `materialCounts` stay as they are today: import-compatible and unused.
- **[Certain]** Legacy fields are never read by active habitat, Housemates, filter, badge, or FAB UI after migration.
- **[Certain]** Existing legacy payloads must survive export/import without being silently discarded.
- **[Certain]** `emptyState()` initializes `habitatLocations: {}` and `habitatLocationMigrationVersion: 1`, and no longer creates `habitatBuilds`.
- **[Certain]** `UndoField` gains `"habitatLocations"`; `applyScopedUndo` and `updateWithUndo` handle it like the existing scoped fields, labelled “habitat locations.”
- **[Likely]** The overall notebook `schemaVersion` can remain `1` because this is an optional field migration inside the existing IndexedDB state blob, not a new table or index. The field-level migration marker prevents replay.
- **[Certain]** No Dexie database version bump is needed unless implementation introduces a new indexed table, which this plan does not require.

## 5. Migration and backup contract

### 5.1 One-time normalization

**[Certain]** A single pure function, `migrateHabitatLocations(state, catalog)`, runs in both load normalization (`normalizeLoadedState`) and import (`validateBackup`, after legacy validation). It replaces `ensureMigratedState` and `migrateLegacyShopping`.

1. **[Certain]** If `habitatLocationMigrationVersion === 1`, return the state unchanged.
2. **[Certain]** Set `habitatBuildLegacySnapshot` to the existing snapshot if present, otherwise to `habitatBuilds` verbatim when it has records. Delete `habitatBuilds`.
3. **[Certain]** Convert each `status: "built"` record into exactly one location record, keyed by its existing ID.
4. **[Certain]** Preserve its ID, habitat ID, `snapshot.habitatName`, region, copies, `locationNote` (trimmed, as `note`), `createdAt`, and `updatedAt`.
5. **[Certain]** Convert an empty, missing, or no-longer-catalogued region to `null` and add `Choose a region`.
6. **[Certain]** Add `Habitat missing from catalog` when the habitat ID is not in the current catalog.
7. **[Certain]** Map the old `Review imported copies` flag to `Possible duplicate`. Drop `Needs review` and any other material-related flag; the snapshot keeps the originals.
8. **[Certain]** Do not convert a `status: "planned"` record into a location; an intention is not evidence that a habitat exists.
9. **[Certain]** Do not merge built records, even when their habitat, region, and note match; they may represent separate physical spots.
10. **[Certain]** If `habitatLocations` already has a record with the same ID, keep the existing record and skip the converted one.
11. **[Certain]** Set `houseShoppingLegacySnapshot` to the existing snapshot if present, otherwise to `houseShopping` verbatim. Delete `houseShopping`.
12. **[Certain]** Stop generating habitat builds from old boolean `shoppingChecklists` and stop generating house quantity lists from the old house checklist. Those lists never represent built habitats, so they produce no locations.
13. **[Certain]** Set the migration marker.

### 5.2 Import validation

- **[Certain]** `validateBackup` keeps validating legacy fields with today's validators, then runs `migrateHabitatLocations`, then validates `habitatLocations`. The import preview and `replaceNotebook` therefore both see the migrated state.
- **[Certain]** Accept current backups that contain only legacy build/checklist fields, normalize them once, and preserve their legacy payloads.
- **[Certain]** Validate every location record's primitive fields, parseable timestamps, positive safe-integer count, record-key/ID match, string `habitatNameSnapshot`, and allowed review flags.
- **[Certain]** Allow an unknown `habitatId` during import so catalog changes do not destroy user-owned location data; flag it `Habitat missing from catalog` instead.
- **[Certain]** Reject a location whose region is neither a catalog area nor `null` with `Choose a region`.
- **[Certain]** Accept backups with both legacy records and already-migrated locations without creating duplicates (§5.1 steps 1 and 10).
- **[Certain]** Keep Storage envelope v2 behavior unchanged; this feature changes only the notebook state inside that envelope.

### 5.3 Backup and settings copy

- **[Certain]** Replace `N habitat builds` with `N saved habitat locations` in the export summary (`src/App.tsx:396`) and import preview (`src/App.tsx:519-520`).
- **[Certain]** Remove active house/habitat checklist counts and gathered-progress descriptions.
- **[Certain]** Do not claim that archived planned builds are active; legacy snapshots are compatibility data only.
- **[Likely]** Show a neutral notebook note when either legacy snapshot is present, matching the existing crafting legacy notice: `Old build-planning data is preserved in this notebook and included in exports, but is no longer shown.`

## 6. Filter and route compatibility

- **[Certain]** Remove `status` from `HabitatCatalogFilters` with no equivalent; location presence is represented by the saved scope.
- **[Certain]** Replace `regionMode: "available" | "builds"` with `scope: "available" | "saved"`.
- **[Certain]** Preserve search, region, unfound-only, and sort behavior.
- **[Certain]** Parse old `regionMode=builds` URLs as `scope=saved`.
- **[Certain]** Ignore old `status=planned`, `status=built`, and `status=none` query values rather than failing or showing an empty page.
- **[Certain]** Serialize only the new query contract after any interaction.
- **[Certain]** Update the active-filter count in `HabitatsPage` to drop `status` and count `scope !== "available"`.
- **[Certain]** Preserve the selected named region when opening habitat detail and when returning to the catalog.
- **[Certain]** The selected region influences quick-save destination and relevant view filtering, but it does not rewrite catalog discovery/availability facts.

## 7. Android distribution parity

### 7.1 Shared behavior

- **[Certain]** Every behavior in §3–§6 applies unchanged to the Android build. No feature code may branch on `VITE_DISTRIBUTION`; the only Android-specific code stays in `src/platform/`.
- **[Certain]** The migration, validators, and location helpers must not read habitat `source` fields, because the Android catalog blanks them. The location record already stores only `habitatNameSnapshot`.
- **[Certain]** The new UI adds no remote URLs, remote images, or external links. `Find in Storage` and `Add landmark` are in-app hash routes. `verify-android-output.mjs` must pass with no new allowlist entries.
- **[Certain]** Any icons (pin, edit, plus) come from the bundled `lucide-react` set already in use, not from remote assets.

### 7.2 Cross-distribution backups

- **[Certain]** A backup exported from either distribution imports into the other. Habitat IDs and `catalog.areas` are identical in both catalogs, so locations never pick up a false `Habitat missing from catalog` or `Choose a region` flag by crossing distributions.
- **[Certain]** A pre-change web backup that holds legacy `habitatBuilds`/`houseShopping` migrates on Android import exactly as it does on web import (§5.2), because migration runs inside `validateBackup`.
- **[Certain]** A legacy snapshot imported from a web backup may still contain habitat source URLs inside `habitatBuildLegacySnapshot`. That is stored user data in IndexedDB, not part of the shipped payload, and the UI never renders it.
- **[Certain]** Android export keeps using `exportNotebookBackup` (share sheet); this change touches only the notebook state inside the envelope.

### 7.3 Android Back and modal behavior

- **[Certain]** The compact region picker and the inline location-row editor each expose a single close/cancel handler, so the planned Android Back adapter can close them in its documented order: picker first, then row edit, then the previous route.
- **[Certain]** Leaving a row editor with an unsaved note through Back must not discard it silently. Back cancels only when nothing changed; otherwise it asks before discarding, matching the release plan's “no discarded edits” rule.
- **[Certain]** If the Android Back adapter lands before this work, register the picker and row editor with it in this change. If it lands after, it must include them. Either way, the Android Back release gate covers them.
- **[Certain]** Removing `BuildModal`, `ShoppingPanel`, and the FAB scrim removes three Back targets; the Back contract test list must drop them.

### 7.4 Lifecycle and persistence on Android

- **[Certain]** Quick save announces success only after the IndexedDB write confirms (§3.3). If Android backgrounds or kills the WebView before that, no success was announced and the in-memory record is lost with the process. This is consistent with the release plan's pending-write rule.
- **[Certain]** When the release plan's pause/resume flush lands, it waits on the same write queue, so quick save needs no extra lifecycle code.
- **[Certain]** Migration runs on first load after an app update, exactly as on web. Do not clear or rename the WebView origin; the migration relies on the existing IndexedDB `state` row.

### 7.5 Release sequencing

- **[Certain]** Android v1 has not been released, so no Play user holds tracker data today.
- **[Certain]** If this change ships before the first Android release, Android v1 goes out with locations only. The Android upgrade test then has no tracker data to migrate, and the migration is covered by unit tests and web-to-Android backup import.
- **[Certain]** If any Android build containing the old tracker is installed on a test device first (internal or closed testing), run an upgrade test from that signed build: create planned, built, regionless, and house-gathered data, update in place, and verify the §5.1 outcome.
- **[Certain]** The hosted privacy page update (§3.8) must be deployed no later than the Android build that contains this change, so the hosted and packaged copies agree.
- **[Certain]** Play Data safety answers do not change: habitat locations are local, user-created, and never collected or shared.

### 7.6 Android documentation updates

- **[Certain]** `docs/android-play-store-release-plan.md:280` and `:483`: replace “checklists” with “habitat locations” in the offline-creation step and the persistence row.
- **[Certain]** Add the region picker and location-row editor to the Android Back contract test list, and remove the build modal, shopping panel, and FAB.

## 8. Repository change map

### 8.1 Habitat domain

- **[Certain]** `src/habitats/types.ts`: remove `BuildStatus`, `RequirementAllocation`, `HabitatBuildRecord`, `HabitatBuildSnapshot`, and `BuildBadge` from active types; add `HabitatLocationRecord`; simplify filters. Keep `NormalizedRequirement` (used by `src/items/requiredBy.ts`). Move legacy build shapes to `src/persistence/legacy.ts`.
- **[Certain]** `src/habitats/builds.ts`: delete. Add `src/habitats/locations.ts` with pure create/update/remove/query helpers, the duplicate guard, and the picker ordering.
- **[Certain]** `src/habitats/BuildModal.tsx`: delete; no modal-based planning or recording remains.
- **[Certain]** `src/habitats/BuildForm.tsx`: rename to `LocationForm.tsx` and keep `RegionChips`, `CopyStepper`, and `parseCopyCount` for the row editor and picker.
- **[Certain]** `src/habitats/migration.ts`: replace with `migrateHabitatLocations` (§5.1).
- **[Certain]** `src/habitats/requirements.ts`: keep `normalizeRequirements` and `requirementSignature` (used by `src/items/requiredBy.ts`); remove `shoppingRequirements`, `buildAllocations`, and `allocationItemKey`.
- **[Certain]** `src/habitats/search.ts`: filter by active locations for Saved here, implement both `Region not recorded` meanings, old-query compatibility, and remove status/build modes.
- **[Certain]** `src/habitats/HabitatsPage.tsx`: implement the action matrix, saved-location summaries, compact region picker, duplicate guard, persistence-aware feedback, and the §3.8 copy.
- **[Certain]** `src/habitats/HabitatDetail.tsx`: replace build management with `My locations`; keep reference requirements and Pokémon content.

### 8.2 Pokémon and Housemates

- **[Certain]** `src/dex/DexPage.tsx`: remove `BuildModal`, build props, build status, and Plan build; show the optional saved-location count and keep requirements.
- **[Certain]** `src/planner/PlannerPage.tsx`: stop reconciling `houseShopping`, render the reference panel from `combinedSupplies`/`environmentSupplies`, rename it, and keep `setHomeCompleted` behavior.
- **[Certain]** `src/planner/recommend.ts`: keep `combinedSupplies` and `environmentSupplies` because they produce reference knowledge.
- **[Certain]** `src/planner/types.ts`: retain `RecommendedHome.completed` and its movement/reset invariants.
- **[Certain]** `src/planner/HomeDetail.tsx`: no change; it gains `Find in Storage` through `ExplainDialog`.

### 8.3 Shopping/FAB removal

- **[Certain]** Delete the whole `src/shopping/` directory once its remaining pieces are moved:
  - `ChecklistFab.tsx`, `ShoppingPanel.tsx`, `QuantityControls.tsx`, `allocations.ts`: delete.
  - `SupplyIcon.tsx`: move to `src/ui/SupplyIcon.tsx` (used by habitat detail and Pokémon detail).
  - `checklists.ts`: move the type shapes the validators still need (`ShoppingChecklists`, `ShoppingRow`, `HabitatChecklist`, `HouseChecklist`, `HouseQuantityList`, `QuantityRow`) into `src/persistence/legacy.ts`; delete all calculation helpers.
- **[Certain]** `src/crafting/types.ts`: remove `HABITAT_HOUSE_GATHERED_DISCLOSURE`.
- **[Certain]** `src/App.tsx`: remove `ChecklistFab`, `checklistScope`, and build counts; update backup and notebook copy.
- **[Certain]** `src/styles.css`: remove build modal, build allocation, shopping panel, checklist FAB, gathered progress, quantity-control, and build status-badge styles only after a class search confirms they are unshared.

### 8.4 Persistence, progress, and shared UI

- **[Certain]** `src/persistence/store.ts`: add location fields and validators, run the migration inside `validateBackup`, keep legacy validators, update `emptyState`.
- **[Certain]** `src/persistence/legacy.ts` (new): legacy build and house-list shapes used only by validators and the migration.
- **[Certain]** `src/progress/context.tsx`: call `migrateHabitatLocations` in `normalizeLoadedState`, stop creating house shopping, return write completion from `update`/`updateWithUndo`, delete the unused `useHouseShoppingUpdate`.
- **[Certain]** `src/crafting/undo.ts`: add the `habitatLocations` scoped undo field.
- **[Certain]** `src/ui/components.tsx`: `EnvLevelsModal` stops writing `houseShopping`; `ExplainDialog` adds `Find in Storage`.
- **[Certain]** `src/storage/search.ts`: reuse `storageSearchHref`; do not create a second search route.
- **[Certain]** `src/storage/types.ts`: update the `newUid` comment that points at the deleted `newBuildId`, or make `newUid` the shared helper.

### 8.5 Tests and public pages

- **[Certain]** `tests/habitats.test.ts`: replace the build, allocation, shopping-migration, and house-quantity suites with location and migration suites; keep catalog, sort, and copy-count suites (update the `BuildForm` import path).
- **[Certain]** `tests/core.test.ts`: replace the checklist round-trip and `reconcileHouseChecklist` tests with legacy-preservation tests.
- **[Certain]** `public/privacy.html`: §3.8 copy change; rebuild `dist-legal/`. The Android build packages the same file.
- **[Certain]** `docs/android-play-store-release-plan.md`: §7.6 updates.
- **[Certain]** No change to `src/platform/`, `capacitor.config.ts`, the `android/` native project, or the Android build scripts.

## 9. Implementation phases

### Phase 0 — Safety fixtures

- **[Certain]** Add fixtures for: no tracker data, planned-only habitat data, built-only habitat data, mixed habitat data, regionless built data, built data with a no-longer-catalogued region, built data carrying `Review imported copies`/`Needs review`, current house gathered data, legacy boolean checklists, and orphaned habitat IDs.
- **[Certain]** Export representative pre-change backups before altering normalization logic.
- **[Certain]** Record expected migrated location rows and legacy snapshot contents in tests.

### Phase 1 — Location domain and migration

- **[Certain]** Add the location record and pure create/update/remove/query helpers.
- **[Certain]** Implement idempotent migration, run it on load and inside `validateBackup`, and validate location records.
- **[Certain]** Move old tracker payloads into legacy snapshots.
- **[Certain]** Add the scoped `habitatLocations` undo field and write-completion results.
- **[Certain]** Update backup summary/import preview copy.
- **[Certain]** Do not remove old UI until migration tests pass.

### Phase 2 — Habitat catalog and detail

- **[Certain]** Replace filter semantics and query compatibility.
- **[Certain]** Replace catalog build actions with the quick-save action matrix and region picker.
- **[Certain]** Add persistence-aware success, Add landmark, and scoped Undo behavior.
- **[Certain]** Replace habitat detail build management with My locations.
- **[Certain]** Remove build controls from Pokémon detail.

### Phase 3 — Housemates reference and Storage handoff

- **[Certain]** Stop generating active house shopping data (planner save and environment levels).
- **[Certain]** Render the planner reference panel from the supply calculation as read-only rows.
- **[Certain]** Add `Find in Storage` to `ExplainDialog`.
- **[Certain]** Preserve the home completion checkbox and its reset behavior when residents or kits change.

### Phase 4 — Delete tracker UI and dead code

- **[Certain]** Remove both FAB routes and the shared shopping panel.
- **[Certain]** Move `SupplyIcon` and legacy types, then delete `src/shopping/`.
- **[Certain]** Remove quantity controls, allocation logic, active checklist logic, build modal, and unused styles.
- **[Certain]** Run `rg` for removed concepts (`habitatBuilds`, `houseShopping`, `BuildModal`, `ChecklistFab`, `gathered`, `Plan build`, `Record built`, `shopping`) and review every remaining result as active compatibility, historical documentation, or missed dead code.
- **[Certain]** Run `build:android:web` and confirm `verify-android-output.mjs` passes with no new allowlist entries.

### Phase 5 — Documentation, copy, and product contract

- **[Certain]** Apply the §3.8 copy changes, including the privacy page, and rebuild the legal site.
- **[Certain]** Update `PRODUCT.md` (line 27 still promises a house/habitat shopping checklist) and `README.md` only after implementation matches this plan.
- **[Certain]** Apply the §7.6 Android release-plan updates.
- **[Certain]** Mark older build/checklist plans as superseded rather than rewriting their historical decisions.
- **[Certain]** Document that Storage records item presence/location; it does not promise live in-game quantities.
- **[Certain]** Document that habitat counts apply to copies at one saved spot.

## 10. Test plan

### 10.1 Unit tests

- **[Certain]** Quick save creates exactly one record with the selected named region, count `1`, blank note, stable ID, catalog name snapshot, and timestamps.
- **[Certain]** A second quick save for the same habitat and region is rejected/no-op, including through the region picker.
- **[Certain]** Explicit Add another location can create a second row in the same region.
- **[Certain]** `""`, `"__none__"`, and non-catalog regions cannot be written as a new location.
- **[Certain]** Picker ordering puts discovery towns first, then the rest, each alphabetical.
- **[Certain]** Editing note, region, and count preserves ID/created time and updates `updatedAt`; assigning a region clears `Choose a region`.
- **[Certain]** Invalid count, invalid region, malformed timestamps, unknown flags, and record-key/ID mismatches are rejected.
- **[Certain]** Built records migrate one-to-one while preserving user-entered fields.
- **[Certain]** Planned records are archived but never become active locations.
- **[Certain]** Regionless and no-longer-catalogued-region built records become `null`-region locations flagged `Choose a region`.
- **[Certain]** `Review imported copies` maps to `Possible duplicate`; `Needs review` is dropped from the location and kept in the snapshot.
- **[Certain]** After migration, `habitatBuilds` and `houseShopping` are absent and their snapshots hold the original payloads verbatim.
- **[Certain]** Re-running migration does not duplicate or modify migrated locations.
- **[Certain]** Unknown habitat IDs remain preserved and flagged.
- **[Certain]** `validateBackup` on a legacy backup returns migrated state, so the preview count equals the number of built records.
- **[Certain]** Current and legacy backups round-trip without dropping tracker payloads.
- **[Certain]** Scoped undo of a quick save removes only that location and leaves an unrelated later change (such as a found mark) intact; it refuses when a later location edit is in the way.
- **[Certain]** Old `regionMode=builds` maps to Saved here; old status filters do not break the route.
- **[Certain]** Saved here filters by user locations (including All regions listing only saved habitats), while Available here continues using catalog associations.
- **[Certain]** Region not recorded lists catalog habitats without discovery regions under Available here, and habitats with `null`-region locations under Saved here.
- **[Certain]** Housemates material totals remain correct as reference rows without gathered state, including for a draft plan.
- **[Certain]** Changing a town environment level no longer writes `houseShopping`.
- **[Certain]** Home completion remains valid, persists, and resets under its existing kit/resident mutation rules.
- **[Certain]** `ExplainDialog` shows `Find in Storage` with an encoded `storageSearchHref` for catalog items, and none for conditions or unresolved names.
- **[Certain]** No route renders a habitat or house checklist FAB.

### 10.2 Interaction and browser acceptance

- **[Certain]** Select a named region, activate `Save in {Region}`, and verify exactly one persisted location after reload.
- **[Certain]** Verify the saved card changes to `✓ Saved here` and cannot create an accidental duplicate.
- **[Certain]** Activate `Add landmark`, verify focus lands on the new row's note field, add a note, save, reload, and verify persistence.
- **[Certain]** Activate the global Undo after quick save and verify the row is removed after reload.
- **[Certain]** From All regions, use Choose location and verify the selected picker region is saved.
- **[Certain]** Under Saved here, open a migrated regionless record from Region not recorded, assign a real region, and verify it leaves the recovery filter.
- **[Certain]** Under Available here, select Region not recorded and verify catalog habitats without discovery regions appear with `Choose location`.
- **[Certain]** Add two physical spots in one region and verify both remain distinct.
- **[Certain]** Verify saved counts on habitat catalog, habitat detail, and Pokémon detail agree.
- **[Certain]** Verify search, sort, unfound-only, back/forward navigation, and copied URLs remain stable.
- **[Certain]** Verify no FAB appears on Habitats, Pokémon, Pokédex, or Planner routes.
- **[Certain]** Verify Housemates reference rows display quantities without progress controls, in both saved and draft plans.
- **[Certain]** Open a Housemates material's explain popup, activate `Find in Storage`, and verify the Storage query is prefilled and chests holding that item are shown.
- **[Certain]** Verify `Find in Storage` also works from a habitat Required supplies item and from Home detail.
- **[Certain]** Verify a home can still be marked Done only when it has residents.
- **[Certain]** Import a pre-change backup with built and planned records and verify the preview count, the migrated locations, and the legacy notice.
- **[Certain]** Repeat core flows at a narrow mobile viewport and with keyboard-only navigation.

### 10.3 Accessibility acceptance

- **[Certain]** Every quick-save action includes the habitat and destination region in its accessible name.
- **[Certain]** Saving, success, failure, and undo outcomes are announced in a polite live region.
- **[Certain]** The compact region picker traps focus only while open, closes on Escape, and restores focus to its trigger.
- **[Certain]** Edit/remove buttons include the location's habitat, region, and note context.
- **[Certain]** Color is not the only distinction between unsaved, saving, saved, and review-required states.
- **[Certain]** Touch targets remain at least 44 by 44 CSS pixels on mobile.

### 10.4 Android acceptance

Run on an Android emulator or physical device with the debug build, in airplane mode:

- **[Certain]** Fresh install: quick save, Add landmark, global Undo, Choose location, and Add another location all work and persist across force-stop and relaunch.
- **[Certain]** The soft keyboard does not cover the focused note field after `Add landmark`; the row scrolls into view.
- **[Certain]** Import a pre-change web backup with built, planned, regionless, and house-gathered data through the Android document picker; the preview count, migrated locations, and legacy notice match the web result.
- **[Certain]** Export from Android through the share sheet, import that file on web, and verify the locations and legacy snapshots round-trip unchanged.
- **[Certain]** `Find in Storage` from a Housemates row and from a habitat requirement opens Storage with the query prefilled, with no network request.
- **[Certain]** No FAB appears on any route.
- **[Certain]** Android Back closes the region picker, then leaves the row editor (asking first if the note changed), then returns to the previous route. If the Back adapter is not yet implemented, record this as an open item on the Android Back release gate instead of a pass.
- **[Certain]** TalkBack reads the quick-save action's habitat and region, and announces the saving, saved, and undo outcomes.
- **[Certain]** Touch targets stay at least 44 by 44 CSS pixels at a 320–360 dp width and at 200% system text.
- **[Certain]** If an Android build with the old tracker was ever installed on a test device, run the §7.5 upgrade test.

### 10.5 Commands

- **[Certain]** Use Node 22 for repository validation.
- **[Certain]** Minimum implementation gate. Both distributions are required; `build:android:web` also runs `npm test`, the Android asset gate, and the Android output scanner:

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run build:web
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run build:android:web
```

- **[Certain]** For Android device acceptance (§10.4), sync and install the debug build:

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run android:run
```

- **[Certain]** A successful build is not sufficient by itself; the migration, reload, mobile, keyboard, and Storage-handoff flows above require browser verification, and §10.4 requires an Android emulator or device.

## 11. Deletion checklist

- **[Certain]** No `Plan build`, `Record built`, `Mark built`, `planned copies`, or `gathered supplies` action remains.
- **[Certain]** No habitat or House list FAB remains, and `src/shopping/` no longer exists.
- **[Certain]** No active `habitatBuilds` or `houseShopping` read or write remains; after migration those fields no longer exist in the notebook.
- **[Certain]** No active UI reads legacy shopping/build snapshots (the notebook legacy notice checks only their presence).
- **[Certain]** No gathered-count control remains in habitat or Housemates UI.
- **[Certain]** No build status filter or badge remains.
- **[Certain]** No legacy plan is silently treated as a built location.
- **[Certain]** No user tracker data is silently discarded during load, import, export, or replacement.
- **[Certain]** Static habitat and Housemates requirement knowledge remains available.
- **[Certain]** Housemates completion tracking remains available.
- **[Certain]** Storage search remains the single way to answer where a recorded item is stored.
- **[Certain]** No public copy (app, privacy page, `PRODUCT.md`, `README.md`) describes build planning or checklists as current features.
- **[Certain]** No Android document (release plan test matrices, Back contract list) lists checklists, the build modal, the shopping panel, or the FAB.

## 12. Definition of done

- **[Certain]** A player can record an already-built habitat in the active named region with one action.
- **[Certain]** A player can add optional landmark detail or additional physical locations from habitat detail.
- **[Certain]** A player can filter habitats by where they are available or where the player saved them.
- **[Certain]** A player can still read all known habitat and home requirements without maintaining a second inventory checklist.
- **[Certain]** A player can open a prefilled Storage search from any catalog item's explain popup.
- **[Certain]** A player can still mark a Housemates home complete after the home is built and its residents are moved in.
- **[Certain]** No tracker FAB, build planner, gathered-material control, planned/built status, or active checklist persistence remains.
- **[Certain]** Existing built habitat records become locations; planned and gathered data remain preserved only as legacy snapshots.
- **[Certain]** The web and Android builds both pass their build gates, and the Android acceptance checks (§10.4) pass on an emulator or device.
- **[Certain]** Backups move between web and Android in both directions without losing locations or legacy snapshots.
- **[Certain]** All automated and browser acceptance checks pass, and documentation describes the shipped behavior rather than the removed system.

## 13. Open questions

- **[Certain]** None. The product behavior, migration rule, FAB removal, Storage handoff, Housemates completion boundary, and the §14 decisions are locked.

## 14. Audit log (2026-09-24)

### 14.1 Corrections from the code audit

- `Region not recorded` already has a catalog meaning under Available here; §3.1 and §3.2 now keep it instead of limiting it to user records.
- `My builds here` with All regions applied no filter; Saved here with All regions now lists only saved habitats.
- The global undo restores the whole notebook for unscoped entries, so “removes only the new location” needed a new scoped `habitatLocations` undo field.
- Import never ran migration, so a legacy backup would have shown `0 saved habitat locations` in the preview and stayed unmigrated until reload; the migration now also runs inside `validateBackup`.
- The planner renders rows from the stored house list, which is empty while drafting; rows now come straight from the supply calculation.
- `EnvLevelsModal` also writes `houseShopping`; it is now in the change map.
- The change map was missing `BuildForm.tsx` (kept as `LocationForm.tsx`), `SupplyIcon.tsx` (moved), `src/items/requiredBy.ts` (keeps `normalizeRequirements`), `src/ui/components.tsx`, `src/crafting/undo.ts`, `src/storage/types.ts`, both affected test files, `public/privacy.html`, and the Habitats hero, empty-state, and notebook copy.
- Built records can carry `Needs review` or `Review imported copies` after a legacy plan was marked built, and regions can drop out of the catalog; the migration now defines both cases.
- The plan kept both `habitatBuilds` and its snapshot, which stored the same data twice; migration now moves it.
- Location counts are defined as rows, not summed copies, matching the mock.

### 14.2 Decisions made in the audit round

- `Region not recorded` keeps both meanings (catalog gap under Available here, regionless locations under Saved here).
- `Find in Storage` lives once in `ExplainDialog`, not as inline links on each row.
- Quick-save feedback: `Add landmark` on the card; Undo through the global banner, scoped to `habitatLocations`.
- Legacy build and house-list data is moved into snapshot fields and the originals deleted.
- The region picker lists all catalog towns, discovery towns first.
- `Review imported copies` maps to `Possible duplicate`; `Needs review` is dropped from locations.
- The privacy page copy is updated in Phase 5.

### 14.3 Android support (added 2026-09-24)

- The plan now covers the Android build explicitly (§7): shared behavior, cross-distribution backups, Android Back, lifecycle, release sequencing, and Android doc updates.
- `build:android:web` moved from optional to required, and Android device acceptance was added (§10.4).
- The privacy page is packaged into the Android build, so its update is tied to the Android release (§3.8, §7.5).
- No Android-specific feature code is needed. The Android catalog blanks habitat `source` fields, and the location model never reads them.
