# Housemate planner: simplification plan

Date: 8 September 2026
Status: proposed; implementation has not started.

## Direction

[Certain] The agreed direction is to focus the Cozy Planner on which Pokémon could share a home and what the player needs for them. Map drawing, plot dimensions, and upfront building-kit selection should no longer be prerequisites.

[Likely] The primary player question is: **“Who should live together, and what should I build or gather for them?”** This is a product hypothesis to validate through use, not a finding from player research.

[Likely] Use **Housemates** as the working navigation label and **Plan homes for your Pokémon** as the page heading. Prefer direct explanations over cozy marketing copy.

## Current implementation

[Certain] The current code provides:

- Required area, rectangular plot dimensions, and kit selection in `src/planner/PlannerPage.tsx`.
- Grouping by environmental preferences and shared favorites, coupled to footprint placement in `src/planner/engine.ts`.
- Home construction details, furnishing suggestions, food preferences, and roommate editing in `src/planner/HomeDetail.tsx`.
- Saved plans containing plot dimensions, kit choices, home positions, and residents in `src/planner/types.ts`.

[Certain] These algorithms are application heuristics. The code does not establish a separate in-game friendship or compatibility mechanic. The catalog has no owned-material counts, item crafting recipes, or complete player unlock state from which to calculate an accurate inventory deficit.

## Proposed first-release experience

[Likely] The requirements below define the proposed implementation, not shipped behavior.

### 1. Select Pokémon

- Default to all uniquely identified Pokémon marked found in the Pokédex.
- Offer an optional area filter and a searchable selection list. An area filter selects from discovery records; it does not assert residency restrictions.
- Include each Pokémon once, even when marked found in multiple areas.
- Show the selected count and one primary action: **Suggest housemates**.
- With no found Pokémon, show a useful empty state linking to the Pokédex rather than generating an empty plan.
- Keep dimensions, maps, kit checkboxes, and quantity-limit fields out of this flow.

### 2. Review suggested groups

- Present home cards with resident portraits and names.
- Explain the recommendation with actual facts: matching recorded environment and specific shared favorite categories.
- Use wording such as **Shared preferences**, **Different environment preferences**, and **Preferences unknown**. Do not show an invented compatibility percentage or guaranteed happiness rating.
- Show a suggested home and occupancy on each card. Do not ask the player to choose every building first.
- Provide **Change housemates**, **Change home**, and expandable **What you need** actions.
- Keep each selected Pokémon visible, either in a group or in a clearly explained needs-review section.

### 3. See what is needed

- **Home construction:** kit, dimensions as reference information, materials and quantities, helper count/specialties, build time, and source link where recorded.
- **Furnishing suggestions:** items matched to favorite categories, with the residents and preferences each suggestion covers.
- **Individual care:** recorded environment and food preferences; missing information remains explicit.
- **Combined supplies:** aggregate construction quantities across homes; list suggested furnishings separately from construction materials and ongoing food preferences.
- Label totals **Required materials**, not **Missing materials**, until actual owned quantities are available.
- Treat one suggested furnishing per group as a planning suggestion, not a verified minimum sufficient for every resident. Do not silently reuse one item across multiple homes.
- Unknown recipes, quantities, reach, or environmental conditions must not appear as satisfied requirements.

### 4. Adjust and save

- Allow moving or swapping residents and splitting someone into a separate group.
- Recalculate explanations, furnishing suggestions, occupancy, and combined supplies after every edit.
- Prevent duplicate residents and capacity overflow. Explain differing environment preferences on a manual grouping without inventing a game prohibition.
- Restrict replacement homes to supported options with enough capacity; show construction requirements before the player chooses.
- Save accepted edits locally and restore them after reload.
- Generating replacement suggestions must preserve the saved plan until the player explicitly applies the replacement. Do not discard edits when the roster or catalog changes.

## Recommendation rules

[Likely] Separate resident grouping from spatial placement entirely. Removing the dimensions form while retaining a hidden arbitrary plot would still make valid recommendations depend on an irrelevant space limit.

[Likely] Use a stable, explainable heuristic:

1. Normalize and deduplicate the selected roster.
2. Prefer matching known environmental preferences; within those groups, prefer shared favorite categories.
3. Respect supported home capacities while evaluating groups. Do not fill every available bed at the expense of preference matches.
4. Keep unknown environments provisional and separate by default. Missing favorites mean unknown evidence, not proven incompatibility.
5. Suggest a supported home that fits the group, preferring less unused capacity and then a smaller footprint, with a stable ID tie-breaker.
6. Explain that the home is suggested for capacity, not confirmed affordability or unlock availability. Allow replacement after generation.
7. If no supported home fits, split the group or show a clear unresolved recommendation; never silently drop residents.

[Likely] Keep kit eligibility exclusions until the underlying rule is verified. Before implementation, check the relevant existing source references for capacity and eligibility assumptions; preserve uncertainty where evidence is incomplete. Do not call a suggestion “cheapest” based only on adding unlike material quantities.

## Implementation sequence

### Phase 1 — Grouping and data contract

- [ ] Introduce a versioned recommendation-plan model independent of plot coordinates.
- [ ] Separate grouping, home suggestion, explanation, and supply aggregation from the placement engine.
- [ ] Define deterministic behavior for missing preferences, ties, unsupported homes, and empty selections.
- [ ] Retain source references and distinguish recorded facts from computed suggestions.

### Phase 2 — Simple page and editing

- [ ] Replace mandatory setup and the main grid with roster selection and home cards.
- [ ] Reuse the useful construction and care details from the existing home view.
- [ ] Add optional area filtering, resident changes, group splitting, and home replacement.
- [ ] Add combined supplies and explicit unknown-data states.

### Phase 3 — Persistence and existing plans

- [ ] Preserve existing spatial plans and their coordinates; do not overwrite them with the new format.
- [ ] Offer a one-time conversion of an existing plan's residents and home choices into the new recommendation format, retaining the original.
- [ ] Use a separate versioned saved-plan field and a single active housemate plan for the first release; defer multiple named plans.
- [ ] Update backup export/import and validation to round-trip both legacy and new plans.
- [ ] Mark recommendations for review when relevant roster/catalog data changes; preserve manual edits.

### Phase 4 — Verification

- [ ] Test roster deduplication, deterministic grouping, capacity, missing-data handling, and preservation of all selected residents.
- [ ] Test that edits update explanations and supplies, and that per-home quantities aggregate correctly.
- [ ] Test legacy preservation, conversion, reload, and backup round trips.
- [ ] Run the project's relevant tests and production build.
- [ ] Verify the actual browser flow on desktop and a narrow mobile viewport: select Pokémon → generate → inspect requirements → edit → reload.
- [ ] Check that a player can reach useful recommendations without entering dimensions or selecting kits.

## First-release acceptance criteria

[Likely] The release is complete when:

- A player with found Pokémon can get suggestions with one primary action from the planner's default state.
- Every recommendation explains its evidence in plain language.
- Every selected Pokémon appears exactly once across groups and unresolved entries.
- Construction requirements, furnishing suggestions, and ongoing care remain distinguishable.
- Missing evidence is visible and never converted into a guarantee.
- Changes persist, supply totals stay consistent, and existing saved spatial plans survive.
- The player-facing flow passes browser verification; automated checks alone do not close the work.

## Deferred scope

[Likely] Defer map assets, grid calibration, terrain recognition, drawing zones, path planning, spatial optimization, inventory tracking, recipe expansion, screenshots, and multiple saved scenarios. Keep the legacy spatial implementation available internally until saved-data preservation is verified.

[Likely] Revisit maps only when use reveals a concrete follow-up need: **“I like these home suggestions; now help me fit them into this location.”** The map should then consume the accepted home plan rather than being required to produce it.

## Relationship to the existing project plan

[Certain] `docs/pokopia-companion-plan.md` records the broader companion scope and the existing Cozy Planner implementation. This document proposes the next planner direction and supersedes mandatory spatial setup for that redesign only. It does not mark any implementation task complete or change the wider storage/scanner roadmap.
