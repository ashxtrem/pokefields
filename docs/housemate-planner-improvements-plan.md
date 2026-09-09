# Housemate planner: occupancy, layout, environment guidance and builds

Date: 9 September 2026
Status: proposed; implementation has not started.

## Purpose

[Certain] `docs/housemate-planner-plan.md` proposed the current Housemates flow and that flow now ships: select found Pokémon → suggest groups → inspect requirements → edit → persist. This document proposes the next round of improvements to `#/planner`, based on four gaps observed in the shipped implementation.

[Likely] The four gaps, in the order they were raised:

1. Group size is fixed at maximum occupancy; the player cannot ask for smaller households.
2. The planning screen buries its own result and repeats detail the modal already carries.
3. The app records six ideal environments but never tells the player how to produce one.
4. The player cannot express a build the catalog does not already contain.

## Existing foundations

[Certain] Relevant current behaviour, read from the code:

- `recommendHousemates` (`src/planner/recommend.ts`) buckets the roster strictly by `Pokemon.environment`, packs each bucket with `packEnvironment`, gives every unknown-environment Pokémon its own group, then calls `assignHomes`.
- `packEnvironment` receives `maxCapacity`, computed as `Math.max(...catalog.kits.map(k => k.capacity))`. Every kit in the shipped catalog has capacity 1, 2 or 4, so this value is always **4**.
- `packEnvironment` fills each group to that capacity unconditionally. There is no affinity threshold; the final member joins even with zero shared favorite categories.
- `assignHomes` selects the supported kit with the least unused capacity, then the smaller footprint, then a stable id tie-break. Eight of the twenty-six kits have capacity 1 or 2 and are therefore unreachable from generation.
- `HousematePlan` (`src/planner/types.ts`) carries `roster`, `sourceRoster`, `areaFilter`, `homes`, `unresolved`, `catalogVersion` and timestamps. It carries no generation settings.
- `PlannerPage` renders a `300px` setup sidebar plus a workspace (`.planner-layout`), collapsing to one column at 850px. `.roster-options` is capped at `max-height: 220px` with an 11px font.
- `HomeCard` renders the match label, every explanation line, kit statistics, a per-card disclaimer, two actions, and a `<details>` block repeating construction, furnishing and care detail that `HomeDetail` also renders.
- `ENVIRONMENTS` in `src/dex/glossary.ts` already records `meaning`, `achieve` and example item ids for Bright, Dark, Warm, Cool, Humid and Dry. `explainTerm`, `TermChip` and `ExplainDialog` already render this material in the Pokédex.
- Every one of the 27 example ids referenced by `ENVIRONMENTS` resolves against `public/data/catalog.json` as of catalog version `2026-09-09.4`. This was checked, not assumed.
- `HomeDetail`'s Care tab currently states that lighting, moisture and temperature need an in-game check, in the same view where the glossary answer already exists.
- `scripts/import-data.mjs` skips any kit whose source href contains `denkit`, so den kits are absent from the catalog entirely.

[Certain] These grouping and suggestion algorithms are application heuristics. The catalog has no owned-material counts, no player unlock state, and no recorded in-game compatibility mechanic.

## 1. Flexible occupancy

[Likely] Expose **maximum residents per home**, not a target number of homes. Home count is a dependent variable: reaching an arbitrary home count would require merging incompatible environment buckets, which contradicts the one rule the grouping rests on. Show the resulting home count as live feedback instead of accepting it as input.

[Likely] Proposed control: a small preset group in the setup panel — **Own space (1)**, **Pairs (2)**, **Balanced (auto)**, **Full houses (4)** — backed by an integer `maxResidents` from 1 to 4.

- The cap is an upper bound. A bucket smaller than the cap still produces a smaller home; the cap never pads a group.
- **Balanced** applies the cap of 4 together with the affinity floor below. The numeric presets apply the cap and keep the existing greedy fill within it.
- Recompute and display "→ about N homes" beside the control before the player generates.

[Likely] Add an **affinity floor** to `packEnvironment`. The shipped code fills to capacity regardless of shared favorites, which contradicts rule 3 of `docs/housemate-planner-plan.md` ("Do not fill every available bed at the expense of preference matches"). The retired spatial engine guarded this with a score threshold; restore the equivalent by declining to add a candidate whose `favoriteOverlap` with the group is zero **when the group already has at least two members**. Stopping early leaves a smaller group, never an unplaced Pokémon.

[Likely] Persist the settings on `HousematePlan` so regeneration, staleness and reload stay consistent. Add `settings: { maxResidents: number; affinityFloor: boolean }` behind a bumped `HOUSEMATE_PLAN_VERSION`, defaulting an absent value to the current behaviour (4, floor off) so existing saved plans keep meaning.

[Likely] Add an **available kits** filter, persisted in `SaveState`, defaulting to all kits selected. Suggestions currently draw from all 26 kits regardless of what the player has unlocked, which makes some output unbuildable. The filter interacts with occupancy: if only capacity-1 kits are available, the effective cap is 1, and the UI must say so rather than silently producing unresolved residents.

[Open] Confirm whether the affinity floor should be a separate toggle or simply the definition of the **Balanced** preset. This plan assumes it ships as the Balanced preset with no separate switch, to keep one concept in the UI.

## 2. Planning screen layout

[Certain] Observed problems:

- At a viewport around 950px the layout has already collapsed to one column, so the primary action sits below a full-height sidebar and the workspace is entirely off-screen. The player presses **Suggest housemates** and sees no change.
- The roster picker is a 220px scroll well at 11px, holding up to several hundred rows, with no select-all, no select-none, no "unhoused only" filter, and inverted checkbox semantics (checked means included, while state is stored as `excluded`).
- Each home card duplicates the detail modal, and repeats the "Suggested for capacity, not confirmed affordability or unlock availability" disclaimer once per home.
- `.home-list` is a single-column grid, and `home-color-${index % 4}` carries no meaning.

[Likely] Proposed changes:

- **Collapse setup after a plan exists.** Replace the sidebar with a one-line summary — selected count, area filter, occupancy preset, and an **Edit selection** control that reopens the panel. Give the workspace the full width.
- **Scroll to the result on generate**, and keep the primary action visible while the setup panel is open on narrow viewports.
- **Add a result summary strip** above the cards: homes, housed, needs review, distinct materials. The page currently has no result headline.
- **Grid the cards** at two to three columns on wide viewports, grouped under environment section headings so the grouping rule is visible rather than only explained.
- **Trim the card** to portraits, names, an environment badge, a kit and occupancy chip, the match label, the furnishings the home needs, and the two existing actions. State the capacity disclaimer once per page.

  [Certain] Correction, 9 September 2026: an earlier revision of this plan said to remove the in-card `<details>` outright because `HomeDetail` carries the same content. That was wrong in practice. Construction detail and individual care are reference material and belong in the modal, but **the furnishings a home needs are part of the answer, not the detail** — a card without them does not say what to go and build. Keep a compact furnishing list on the card (item name plus the favorite categories it covers, median five rows, maximum eight measured across the shipped catalog), with the heading opening the modal's Furnishings tab for the full version.
- **Colour by environment** rather than by index, following the approach in `docs/pokedex-type-colors-plan.md`. Reuse that document's contrast rules; do not invent a second colour system.
- **Improve the roster picker**: select all, select none, a "not yet housed" filter, per-environment counts, and a larger touch target. Keep the stored `excluded` representation; correct only the presentation.

[Likely] Verify the result on a wide desktop viewport and a narrow mobile viewport. Layout claims here are based on one 952px screenshot and the stylesheet; both breakpoints need a real check before the work closes.

## 3. Environment guidance

[Certain] This is the largest gap between what the app knows and what it says. The `achieve` guidance and example items exist in `src/dex/glossary.ts` and are already rendered in the Pokédex; the planner does not use them.

[Likely] Proposed changes, smallest first:

1. Render each environment value as a `TermChip` on home cards and in `HomeDetail`'s Care tab, so the existing glossary dialog is one tap away. No new data.
2. Add an **Environment setup** section to `HomeDetail` for the group's shared environment: the `achieve` paragraph, plus the example items resolved through `resolveItem` so each carries its obtain lines and source link.
3. Add those items to the house shopping checklist as their own section, separate from construction materials and from furnishing suggestions, consistent with the separation already established in `docs/shopping-checklist-plan.md`.
4. For a home where `environmentMatch` returns `different`, state plainly that one space cannot hold both conditions, and offer a **split by environment** action rather than only reporting the mismatch.

[Certain] The `achieve` strings and example lists are hand-authored application guidance, not extracted from a cited source table like the rest of the catalog. Promoting them from a Pokédex footnote into a shopping list raises their apparent authority.

[Likely] Therefore:

- Label the section as app guidance, distinct from recorded requirements, in the same way furnishing suggestions are already distinguished from recorded materials.
- Do not mark environment items as satisfied requirements, and do not include them in construction totals.
- Add a test in `tests/glossary.test.ts` asserting every `ENVIRONMENTS` example id resolves against the catalog, so the list cannot rot silently across catalog imports.

## 4. Builds

[Open] "Custom builds" has at least four readings. This plan proposes the second and defers the rest; confirm before the work starts.

**(a) Player-defined kits.** The player enters a house the catalog does not contain — name, capacity, footprint, materials. Fits `SaveState` cleanly, but breaks the project's sourced-data discipline and complicates staleness and shopping reconciliation. **Deferred.** If taken up later, it needs a persistent "player-defined, unsourced" badge everywhere the kit appears, and export/import round-trip coverage.

**(b) A complete buildable spec per home.** Kit, furnishings covering favorites, environment items, and food, assembled into one recipe the player can take into the game. This is mostly composition of parts that already exist, it is where section 3 naturally lands, and it carries no new data risk. **Proposed for this round.**

**(c) Den kits.** Excluded at import because size eligibility is not modelled, so they can never be suggested. This is a data and eligibility gap, not a UI gap. **Deferred**, and tracked separately from the UI work in this document.

**(d) Manual empty home.** Today a new home only appears via split or move-to-new. An **Add a home** action that creates an empty group the player fills by hand is a small, self-contained addition. **Proposed for this round**, on the condition that an empty home is pruned on save exactly as `moveResident` already prunes emptied homes.

## Implementation sequence

### Phase 1 — Environment guidance

- [ ] Surface environment terms as `TermChip` on home cards and the Care tab.
- [ ] Add the Environment setup section to `HomeDetail`, resolving example items through the existing glossary helpers.
- [ ] Add environment items to the house checklist as a separate, clearly labelled section.
- [ ] Handle mixed-environment homes with an explicit statement and a split action.
- [ ] Add the glossary example-id resolution test.

### Phase 2 — Occupancy

- [ ] Add `settings` to `HousematePlan` behind a bumped plan version, with a default preserving current behaviour.
- [ ] Thread `maxResidents` into `packEnvironment`; add the affinity floor.
- [ ] Add the preset control and the live home-count estimate to the setup panel.
- [ ] Add the available-kits filter to `SaveState` and to `assignHomes` / `eligibleKits`.
- [ ] Confirm regeneration, staleness and backup round-trip behaviour under the new fields.

### Phase 3 — Layout

- [ ] Collapse the setup panel to a summary once a plan exists; scroll to the result on generate.
- [ ] Add the result summary strip and the environment-grouped card grid.
- [ ] Trim `HomeCard` and remove the duplicated `<details>` block.
- [ ] Apply environment colours following the type-colour document's contrast rules.
- [ ] Improve the roster picker controls.

### Phase 4 — Builds

- [ ] Assemble the per-home buildable spec from kit, furnishings, environment items and food.
- [ ] Add the manual **Add a home** action with empty-home pruning.

### Phase 5 — Verification

- [ ] Cover the occupancy cap, the affinity floor, the kit filter, and settings persistence in `tests/core.test.ts`.
- [ ] Confirm every selected Pokémon still appears exactly once across groups and unresolved entries under every preset.
- [ ] Run the project's tests and a production build.
- [ ] Verify the browser flow on a wide desktop viewport and a narrow mobile viewport: select → set occupancy → generate → read environment guidance → edit → reload.

## Acceptance criteria

[Likely] The round is complete when:

- The player can ask for smaller households and see the home count change before generating.
- No group is padded to capacity with a resident sharing no recorded favorite category, under the Balanced preset.
- Suggestions can be restricted to kits the player has actually unlocked, and the consequence is stated when that restriction forces smaller homes.
- The result of generating is visible without scrolling on both verified viewports.
- Each home states its environment and how to produce it, with the guidance labelled as app guidance rather than a recorded requirement.
- Every item and material name in the planner opens the explain popup, so "where do I get this" is answerable without leaving the page. Quantities stay outside the control: `explainTerm` reads a quantity as a habitat footprint instruction, which is the wrong sentence for a construction or furnishing count.
- Environment items appear in the checklist separately from construction materials and furnishing suggestions.
- No home card repeats content that the detail modal already carries.
- Existing saved plans load unchanged, and backups round-trip across the plan version bump.

## Deferred scope

[Likely] Player-defined kits, den kit support, map or spatial placement, inventory tracking, multiple named plans, and any cost ranking across unlike materials. Cost ranking in particular stays out until owned quantities exist; adding unlike material counts does not produce a "cheapest" kit.

## Open decisions

1. Occupancy: affinity floor as its own toggle, or as the definition of the Balanced preset? This plan assumes the latter.
2. Builds: is (b) the intended reading of "custom builds", or is (a) player-defined kits the actual need?

## Relationship to existing documents

[Certain] This document extends `docs/housemate-planner-plan.md`, which remains the record of the shipped Housemates direction. It reuses the checklist separation from `docs/shopping-checklist-plan.md` and the colour rules from `docs/pokedex-type-colors-plan.md`. It does not change the wider scope recorded in `docs/pokopia-companion-plan.md`, and it marks no existing implementation task complete.
