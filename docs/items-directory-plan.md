# Items directory: sections, buildings and collectibles

Date: 10 September 2026
Status: Phases 1–4 implemented and tested on 10 September 2026.

## Direction and authority

[Certain] The requested direction is a browsable item area whose entries are not only recipes: **All Items · Crafting Recipes · Food & Cooking · Buildings · Collectibles**, with collectibles explicitly including music CDs.

[Likely] Product objective: **Look up any item in the game, see what kind of thing it is, how it is obtained, and — for numbered sets — how much of the set is documented.** Crafting keeps its current job (how a recipe is unlocked and where its materials come from) and becomes one section of this area rather than the only door into item data.

[Likely] The specifications below are implementation defaults derived from that direction and from the source inspection in section 2. They do not authorize deployment, a data re-import, or a navigation redesign beyond section 4.

## 1. Outcome and boundaries

[Likely] In scope:

- A per-item **group** classification imported from the Serebii item index, carried in the catalog rather than inferred at render time.
- A **numbered-collection** model, first used by Music CDs, that can state coverage honestly (documented versus set size).
- Non-residential **building kits**, which the importer currently discards.
- An **item detail** view for the 872 items that have no recipe and therefore no page today.
- Section tabs over one item list.

[Certain] Out of scope for this plan: item flavor text (section 3.4), inventory tracking, a second progress model for materials, map placement, and any change to how recipes themselves are extracted or evidenced.

## 2. Inspected baseline

[Certain] Facts established by reading the repository and the cached source on 10 September 2026:

- `public/data/catalog.json` holds 1755 items, 26 kits, 365 Pokémon. Items carry `id`, `name`, `categories`, `source`, optional `locations`, `recipe`, `recipeMeta`.
- `categories` are the game's preference categories (`Metal stuff`, `Round stuff`, …), not item types. They answer "which Pokémon likes this", not "what is this".
- 883 items have a `recipe`; 872 do not. `isRecipeCandidate` (`src/crafting/catalog.ts:211`) gates the entire Crafting section on that field, so **those 872 items have no page anywhere in the app**.
- `recipeMeta.kind` is `craft` for 708, `cook` for 34, `unknown` for 141.
- `scripts/import-data.mjs:760` names `decoration`, `food`, `relaxation`, `road`, `toy` as `indexSkip` — they are section pages, harvested for item links, and the section each item came from is discarded.
- `scripts/import-data.mjs:699` drops any build kit without a resident capacity: `if (!width || !depth || !capacity || href.includes("denkit")) return;`. The Serebii index lists 59 kits; `catalog.kits` has 26.
- All 59 kits **do** exist in `catalog.items` with acquisition `locations` (for example `concertstagekit` records its shop unlock and the Rocky Ridges rank requirement). Only the footprint, capacity, helpers, materials and build time are missing for the 33 non-residential ones.
- `SaveState` (`src/persistence/store.ts:23`) is `schemaVersion: 1` with optional feature fields (`crafting`, `habitatBuilds`, `houseShopping`, …). Feature state has been added before by adding an optional key.
- `src/ui/navigation.ts` defines four sections (`dex`, `habitats`, `planner`, `crafting`), per-section route memory in `sessionStorage`, and `isRememberedRouteAvailable` guards for Pokémon, habitats and recipes.

[Certain] The cached index page (`.cache/sources/2608a43c…`, `items.shtml`) is divided by `<h2>` anchors into these sections. Counts exclude the five section-index links; every id listed resolves to an existing catalog item:

| Section         | Items | Section         | Items |
| --------------- | ----- | --------------- | ----- |
| Materials       | 60    | Nature          | 260   |
| Food            | 58    | Buildings       | 167   |
| Furniture       | 140   | Blocks          | 231   |
| Misc.           | 185   | Kits            | 59    |
| Outdoor         | 88    | Key Items       | 9     |
| Utilities       | 89    | Other           | 349   |
| Lost Relics (L) | 43    | Lost Relics (S) | 46    |
| Fossils         | 22    |                 |       |

[Certain] 1695 of 1755 items appear on that index; 60 do not (they entered the catalog through the API record, kit material tables, or favorite-category pages). 115 ids appear in more than one section, so membership is a set, not a single value.

[Certain] Music CDs are identifiable without guessing: their index description begins `Music CD #N`. 49 are documented and the numbering reaches **#109**, so the set is known to be incomplete in the source. In the catalog today they are invisible — single category `Round stuff`, location `In glowing terrain` or nothing, no recipe, no page.

[Certain] 111 items are wallpapers, identifiable by a `(wallpaper)` name suffix, currently pooled into `Other` with paint balloons, fireworks and the music CDs.

## 3. Data model and importer

### 3.1 Item groups

[Likely] Add to `Item`:

```ts
/** Serebii item-index sections this item is listed under. Empty means unsorted. */
groups?: string[];
```

[Likely] Parse `items.shtml` by `<h2>` anchor, record every section an item appears under, and keep the raw section labels (`Lost Relics (L)`, `Misc.`) rather than renaming them at import time. Display names belong in the UI. An item with no section renders as **Unsorted** and is never silently assigned one.

[Likely] `groups` is descriptive of the source page only. It does not override `recipeMeta`, does not affect crafting evidence, and carries the same provenance treatment as other imported facts: section membership is attributed to the index page with its retrieval date.

### 3.2 Numbered collections

[Likely] Add to `Item`:

```ts
/** Membership in a numbered in-game set, e.g. Music CD #2. */
collection?: { set: "music-cd"; number: number };
```

[Likely] Derive `set: "music-cd"` and `number` from the `Music CD #N` description prefix. Store the derived facts only, not the sentence they were read from (section 3.4).

[Likely] The set size is **the highest observed number**, not the count of documented entries, and the UI states both (`49 of 109 documented`). Wallpapers get `groups: ["Wallpaper"]` from the name suffix but no number: no numbering is visible in the source, and inventing one would be a false claim of completeness.

### 3.3 Kits and structures

[Likely] Replace the capacity filter with a classification. Every kit on the build index is imported; those with a resident capacity are `kind: "residence"`, the rest `kind: "structure"`:

```ts
export interface Kit {
  /* …existing fields… */ kind: "residence" | "structure";
}
```

[Certain] This is the one change in this plan that can break existing behavior. The planner consumes `catalog.kits` for placement and `availableKitIds` for unlocks; admitting 33 structures without filtering would offer un-liveable buildings as homes. **Every planner and shopping read of `catalog.kits` must filter `kind === "residence"` in the same change**, and a test must fail if an unfiltered read is reintroduced.

[Likely] `capacity`, `helpers` and `buildTime` may be absent for structures. Model them as `number | null` / `string | null` and render "Not yet documented" rather than `0`, which would read as a recorded figure.

[Likely] Den kits stay excluded, as `README.md` already documents, and the exclusion moves from an inline condition to a named constant so it is greppable.

### 3.4 Item descriptions — decision required

[Certain] The index carries full in-game flavor text for every row. The project's stated sourcing position (`README.md`, `docs/research/crafting-licensing.md`) is independently extracted **factual** tables, with per-item source links retained.

[Likely] Default: **do not import descriptions.** Import only facts derived from them (the CD number, the section). This keeps the existing licensing posture unchanged. If the owner decides otherwise, that is a deliberate scope change to be recorded in `docs/research/crafting-licensing.md` before any description text lands in `catalog.json` — not a detail to settle inside an importer diff.

### 3.5 Re-import cost

[Certain] Every page this plan reads is already in `.cache/sources`; the item index and the 59 build pages need no new network fetches unless the cache is deliberately cleared. The catalog version must be bumped and the diff reviewed, per the existing rule in `README.md`.

## 4. Navigation and routes

[Likely] Keep four top-level sections. Rename the fourth from **Crafting** to **Items**, with tabs inside it. The screenshot that prompted this work shows five flat sidebar entries; adopting that literally would mean five of nine top-level destinations pointing at one data set, and a topbar-to-sidebar layout change that no other part of the app has asked for. Tabs deliver the same five entry points at the cost of one click.

[Likely] Routes:

- `#/items` — the directory, tab in the query string (`#/items?tab=collectibles`) so a tab is linkable and survives the existing route memory.
- `#/items/:itemId` — item detail.
- `#/items/recipe/:recipeId` — recipe detail, unchanged in content.
- `#/crafting` and `#/crafting/recipe/:id` — **retained as redirects, not deleted.** Both are reachable from `sessionStorage` route memory written by the shipped build, from `?uses=` deep links, and from cross-domain links in habitat requirements, home furnishings and the glossary.

[Likely] `NavSection` gains `items` and keeps accepting the stored string `crafting`, mapping it to the new section. A stored route that no longer resolves already falls back through `isRememberedRouteAvailable`; extend its guard with `hasItem`.

## 5. Sections and their contents

[Likely] Each tab is a filter over one list and one component, not five bespoke pages. Counts below are from today's catalog and will be recomputed at build time, never hardcoded in the UI.

| Tab              | Membership rule                                                                                          | Today            |
| ---------------- | -------------------------------------------------------------------------------------------------------- | ---------------- |
| All Items        | every catalog item                                                                                       | 1755             |
| Crafting Recipes | `recipe.length > 0`                                                                                      | 883              |
| Food & Cooking   | `groups` includes `Food`, or `recipeMeta.kind === "cook"`                                                | 58 (34 cookable) |
| Buildings        | `groups` includes `Buildings` or `Kits`                                                                  | 226 (59 kits)    |
| Collectibles     | `groups` includes `Key Items`, `Lost Relics (L)`, `Lost Relics (S)` or `Fossils`, or `collection` is set | 169              |

[Certain] All 34 cooking recipes are already inside the Food section, so that tab's two rules agree rather than compete.

[Likely] Tabs are not mutually exclusive and must not claim to be: an item can be a kit and a recipe. The tab bar shows counts; it does not show percentages of a whole.

[Likely] Within Collectibles, group by set with per-set coverage: Music CDs `49 of 109 documented`, Lost Relics (L) 43, Lost Relics (S) 46, Fossils 22, Key Items 9. A set whose size is unknown says so instead of showing a denominator equal to its own contents.

## 6. Item detail

[Likely] `#/items/:itemId` serves the 872 recipe-less items and reuses the recipe page's existing sections rather than introducing a second visual language:

- Identity: name, image with the existing text fallback, groups, preference categories.
- **How it is obtained**: the item's `locations`, with the same attribution and "Not yet documented" treatment recipes already use. Kit-sourced locations (`Concert stage kit (Build Kit)`) link to that kit.
- **What it is used in**: `recipesConsumingItem` — already implemented in `src/crafting/catalog.ts:278`.
- **Where it is required**: habitat requirements and home furnishings that name it.
- For a kit: footprint, capacity, helpers, build time and materials when documented; for a structure, the fields that are not documented say so.
- For a collectible: its set, its number, and the set's documented coverage.

[Likely] An item that also has a recipe links to its recipe page; the recipe page links back. The recipe page is not merged into the item page in this plan — its evidence model and learned marks are settled behavior and changing them is a separate decision.

## 7. Saved state

[Likely] Collectibles want "have it" marks. Add one optional key, following how `crafting` was added:

```ts
/** Collectible items the player has recorded. Absent means none. */
collected?: string[];
```

[Likely] Rules: no schema-version bump (the field is additive and absent-safe); marks are a manual record and are never inferred from discoveries, plans or shopping progress; an id that no longer resolves is retained, not dropped, and surfaced the way unavailable learned recipes already are; export/import round-trips it; and marking is undoable through the existing undo path.

[Likely] Marks are permitted only on Collectibles. A "collected" concept across all 1755 items is an inventory feature, and inventory is out of scope (section 1).

## 8. Phases and exit evidence

### Phase 1 — Importer

- [x] Emit `groups` and `collection`; import every non-den kit with `kind`; catalog version bumped to `2026-09-10.2`.
- [x] Tests over the built catalog: an item in two sections (`luckyegg`), items on no section, a `Music CD #N` row, a structure kit, a kit with a blank capacity cell, a den kit still excluded, and no `description` key on any item.
- [x] Exit evidence: `docs/research/import-report.json` now carries per-section counts, the unsorted ids, per-set coverage and kit kinds. 1699 of 1767 items classified, 68 unsorted and named. No description text in the catalog diff. The import ran entirely from `.cache/sources`.

[Certain] Three source realities the plan did not anticipate, each resolved by keeping the two cases apart rather than by choosing a value:

- **A blank capacity cell is not a documented zero.** Aqua cottage kit, Basin Pokémon Center kit, Clock tower, Laboratory, Ocean temple and Supermarket kits leave it empty. Classifying them `structure` would have asserted that a cottage is not a home, so `kind` gained a third state, `unknown`, and section 3.3's two-value model is superseded by section 3.3 as amended.
- **Five Pokémon Center kits record no footprint at all.** They are imported with null dimensions and can never be placed.
- **The item index disagrees with other pages about spelling.** A habitat requirement table calls it "Poke Ball Bed"; the index calls it "Poké Ball bed". Whichever page was read first won, so the index is now the naming authority and later pages contribute existence only.

[Certain] Two pre-existing importer defects were found by re-importing and fixed, because Phase 1 could not otherwise produce a catalog as good as the shipped one. **Both reproduce with the unmodified script at HEAD**, so neither was introduced here:

- **Accent-blind slugs.** `apiSlug` stripped `é` instead of folding it, so "Poké Ball bed" slugged to `pokballbed` and matched neither its own id nor its API record. Three items (`pokeballbed`, `pokeballsofa`, `pokeballlight`) silently lost their locations and recipes on any re-import. Slugs now fold diacritics, and recipe coverage went from 883 in the shipped snapshot to 885 with no losses.
- **Non-deterministic category order.** Favorite-category pages are fetched concurrently, so append order varied per run and a re-import reshuffled every multi-category item for no reason. Categories are a set, not a ranking, and are now sorted.

### Phase 2 — Kit classification safety

- [x] Every planner, shopping and persistence read of `catalog.kits` now goes through `plannableKitMap`/`plannableKits` (`src/catalog/types.ts`), which admit only documented residences with a footprint and capacity. Making `capacity`, `width`, `depth` and `height` nullable turned the compiler into the enumerator: it named all 34 call sites, and `PlannableKit` narrows them without null checks.
- [x] Exit evidence: `canPlace` and `generatePlan` refuse a structure, an `unknown`-capacity kit and a footprint-less kit; `validateBackup` refuses an `availableKitIds` naming a structure; the plannable set is still exactly the 26 residences of the shipped snapshot, field-for-field unchanged, and the full-roster planning test passes.
- [x] Placement rescans the kit list per candidate square, so the filtered lookup is memoized per catalog. The full-roster test runs in ~0.9 s, faster than the linear `find` scans it replaced.

### Phase 3 — Directory and detail

- [x] Items section, five tabs, item detail, kit detail, collectible sets; `#/crafting*` redirects.
- [x] Exit evidence: a shipped-build `sessionStorage` route for `crafting` resolves; a `?uses=` deep link resolves; each tab count matches a count computed from the catalog in a test, not from prose.

### Phase 4 — Collected marks and verification

- [x] `collected` state, undo, export/import, unavailable-id handling.
- [x] Exit evidence: a pre-change backup imports with no marks and nothing else altered; a mark survives reload, export and re-import in a clean profile; an id removed from the catalog stays in the payload and is explained in the notebook dialog.
- [x] Tests, typecheck and production/offline build under Node 22; update `docs/navigation-ux.md`. (`README.md` was updated in Phase 1 to describe `groups`, `collection` and kit kinds.)

## 9. Acceptance scenarios

| Scenario                 | Required observable result                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Recipe-less item         | An item with no recipe opens its own page with obtained-from, used-in and required-by sections                |
| Unsorted item            | One of the 60 unindexed items reads Unsorted; no section is inferred for it                                   |
| Multi-section item       | An item in Furniture and Lost Relics (L) appears under both tabs and lists both groups once                   |
| Music CD                 | A CD shows its number and its set reads "49 of 109 documented", not "49 of 49"                                |
| Wallpaper                | A wallpaper is grouped as such and shows no invented set number                                               |
| Structure kit            | A Concert stage kit page shows its unlock from item locations and says which build figures are not documented |
| Residence kit            | A cottage kit shows footprint, capacity, helpers, materials and build time as today                           |
| Planner isolation        | Structures never appear as placeable homes; an existing accepted plan is unchanged after the kit import       |
| Kit-sourced item         | An item whose location names a kit links to that kit's page                                                   |
| Tab counts               | Each tab's count equals the catalog-derived count; overlapping membership is not presented as a partition     |
| Old route                | `#/crafting` and a stored `#/crafting/recipe/:id` both resolve after the rename                               |
| Cross-domain link        | A habitat requirement still reaches its recipe, and now also reaches its item page                            |
| Collected mark           | Mark, reload, export, re-import in a clean profile: the mark survives; undo restores prior state exactly      |
| Unavailable collected id | A mark for a removed item is retained and explained, not discarded                                            |
| Old backup               | A pre-change backup imports with no collected marks and every other field preserved                           |
| Offline                  | An item page never opened online renders with text fallbacks and no error                                     |
| Responsive               | 360/390 px and desktop: tab bar does not overflow horizontally; long location lists wrap                      |
| Accessibility            | Tabs are keyboard-reachable with correct `aria-current`; collected marks announce state change                |

## 10. Settled questions

[Certain] Decided by the owner on 10 September 2026, in answer to the three open questions this plan was written to raise:

1. **Descriptions** (section 3.4) — **derived facts only.** The CD number and the section membership are imported; no in-game flavor text enters `catalog.json`. The licensing posture in `README.md` and `docs/research/crafting-licensing.md` is unchanged, and Phase 1 exit evidence checks the catalog diff for description text.
2. **Navigation shape** (section 4) — **one Items section with five tabs.** The topbar keeps four top-level entries; the flat five-entry sidebar and its layout change are not adopted.
3. **Section labels** — decision delegated. Applying section 3.1: **raw source labels are stored** (`Lost Relics (L)`, `Misc.`) so the catalog stays a faithful record of the index, and **display names are applied only in the UI**, where `Misc.` reads as `Miscellaneous` and the two relic sections read as `Lost Relics (large)` / `Lost Relics (small)`. A group with no display mapping falls back to its raw label rather than being hidden.

## 11. Known source artifacts

[Certain] Recorded so they are not rediscovered as bugs:

- `coppeingot` ("Coppe ingot", an upstream typo for a copper ingot) and `gold` are listed on the item index but their icons 404. Both render through the existing text fallback.
- 68 items are unsorted. Most are not really items: they are generic requirement labels the habitat tables name ("seat (any)", "tall grass (any)") and upstream typos ("slylight", "carboadboxes"). They are listed in the import report and must read as Unsorted, never be assigned a section.
- The Music CD set is documented to #109 with 53 entries recorded, so 56 numbers are unaccounted for upstream.

## 12. How `[Likely]` becomes `[Certain]`

[Certain] The promotion rule from `docs/Crafting implementation plan.md` section 13 applies unchanged: a `[Likely]` becomes `[Certain]` only with a repository citation, a decision ID with a passing test, an evidence record with source URL and retrieval date, or a named verification artifact. Implementing something never promotes it. Section counts in this document come from the cached index page and must be regenerated by the Phase 1 report before they are cited as current.
