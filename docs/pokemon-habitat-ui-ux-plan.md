# Pokémon habitat UI/UX improvement plan

Date: 9 September 2026
Status: implemented and verified locally on 9 September 2026.
Reference: `http://localhost:5174/#/pokemon/ivysaur` and the supplied habitat screenshot.

## Objective and approved scope

[Likely] A compact habitat card will help players answer three questions faster: what to build, what materials they still need, and where/when to look.

[Certain] The approved direction covers the habitat section across Pokémon detail pages, including mobile and inventory comparison. Preserve the cream-and-sage style; improve hierarchy, spacing, contrast, and interactions. This document records the implementation plan; approval did not request implementation yet.

## Current implementation and constraints

[Certain] Inspected on 9 September 2026:

- `src/dex/DexPage.tsx` renders habitats inside the **Habitats & Spawns** tab, using repeated `TermChip` controls for requirements and encounter facts.
- `src/dex/glossary.ts` already provides requirement parsing, item resolution, and habitat/item/condition explanations.
- `src/styles.css` contains the habitat layout and shared detail-page styling.
- Habitat requirements are strings in `src/catalog/types.ts`; item records have no dedicated image field.
- `src/persistence/store.ts` and `src/progress/context.tsx` save discovery and planner state, but contain no owned-item quantities. Inventory comparison requires a small persistence extension.
- Time and weather currently fall back from habitat data to Pokémon data. Missing values must remain distinguishable from unrestricted availability.
- Existing uncommitted changes touch the detail page, styles, glossary, catalog, and shared components. Build on that work without overwriting it.

## Proposed experience

[Likely] Implement the following approved design as the first pass:

### 1. Compact habitat card

- Desktop: illustration on the left; title, rarity, requirements, and encounter facts on the right. Start with an approximately 220–280 px illustration column and a flexible content column.
- Mobile: stack the illustration above the content; reduce the illustration size so requirements remain easy to reach.
- Keep the habitat name as the strongest heading and show rarity as a small badge beside it.
- Handle multiple habitats as separate cards, each with its own requirements and conditions.
- Use an intentional placeholder when an image is missing or fails; preserve the image aspect ratio.

### 2. Prominent requirements

- Put **Requires 8 × Wildflowers** directly beneath **Field of Flowers** for the supplied example.
- For longer recipes, use a compact list with one requirement per row, keeping quantities easy to compare.
- Make item names clear controls that open existing item details. Use real item thumbnails only when a verified asset mapping exists; otherwise use a neutral item icon.
- Keep placement conditions and generic alternatives separate from exact inventory items. Do not convert every parsed requirement into an owned-item count.

### 3. Readable encounter facts

- Replace the pill wall with aligned **Locations**, **Time**, and **Weather** rows.
- Retain every recorded location in a wrapping list; do not hide essential information behind an expansion by default.
- Prefer concise text over repeated outlines. Keep explanatory details reachable through descriptive controls where useful.
- Use **Any time** or **Any weather** only when verified data semantics establish unrestricted availability. Listing several known values is not sufficient evidence.
- Preserve existing time/weather fallback behavior and show **Not recorded** for missing information.
- Keep the reference link in a quiet card footer.

### 4. Small, honest inventory comparison

- Add a shared local quantity record keyed by stable item IDs and a compact **Set owned quantity** / **Edit quantity** control alongside supported material requirements.
- Unset quantities show **Not tracked** with an invitation to enter a count. An explicit zero is a known quantity, not the same as unset.
- For a known count, show **You have X / 8 · Need Y more**, where `Y = max(8 - X, 0)`. If sufficient, show **Enough materials** rather than implying the habitat is built or a spawn is guaranteed.
- Accept only nonnegative safe integers; allow clearing a count back to unknown.
- Reuse each saved count across Pokémon pages. Comparison never consumes or reserves items, and separate habitat cards must not imply all recipes can be fulfilled simultaneously from the same stock.
- Compare only requirements with a known quantity and unambiguous item identity. For alternatives, unresolved names, and placement conditions, retain the requirement and explain why no automatic count is shown.
- Integrate the quantity record with local saving and backup import/export. Existing saves and backups must continue to load with inventory untracked; validate new quantities before importing.
- Show save failures using the existing persistence feedback and prevent edits before storage is ready.
- Keep scope bounded: no new inventory dashboard, screenshot import, crafting engine, or planner allocation system.

### 5. Clear actions and accessible styling

- Add **View habitat** as the main card action, opening the existing habitat explanation with relevant recipe/context. Keep **View reference** distinct as the external source link; do not create a dead-end route.
- Remove repeated decorative info icons; preserve access to useful explanations through clearly named buttons or links.
- Use darker body text, quieter labels, fewer borders, and a consistent spacing scale.
- Provide visible keyboard focus, descriptive accessible names, and practical touch targets of at least 44 × 44 px for controls.
- Support click, tap, keyboard activation, Escape dismissal, and focus return for detail overlays. Do not require hovering to access information.

## Implementation sequence

[Likely] Work through these slices in order, recording completion and evidence here:

- [x] **1. Audit and mapping:** inspected representative habitat records, existing requirement parsing, item resolution, and reusable detail overlays. Exact catalog items are trackable; placement requirements remain informational.
- [x] **2. Card layout:** added a focused habitat card with responsive desktop/mobile composition, image fallback, and stronger hierarchy.
- [x] **3. Facts and actions:** replaced repeated fact chips with readable rows, retained source links, and added accessible habitat/item detail actions.
- [x] **4. Inventory support:** added typed local quantities, backward-compatible backup validation, editable counts, and honest deficit calculation.
- [x] **5. Verify and refine:** completed automated and browser checks described in the completion record.

## Acceptance checks

[Likely] The following checks define completion, not results already obtained:

- Ivysaur's habitat illustration, title, rarity, requirements, and encounter facts form one compact composition without the screenshot's large unused area beside the image.
- All recorded requirements, locations, times, weather, and source links remain available; no unsupported “Any” summaries appear.
- Verify desktop at 1440 px, tablet at 768 px, and mobile at 390 px plus a narrow 320 px layout. No horizontal overflow, clipped names, or inaccessible controls; check 200% zoom.
- Inspect a Pokémon with multiple habitats, long location/requirement lists, missing metadata, and alternative or placement requirements. Use controlled fixtures if real records do not cover a case.
- Test owned quantities of unset, 0, below requirement, equal to requirement, and above requirement; reject negative, fractional, non-finite, and unsafe integer values.
- Verify counts update across pages, survive reload, and round-trip through backup export/import. Confirm old saves/backups retain discovery and planner state and show inventory as untracked.
- Verify unsupported/ambiguous requirements never falsely report enough materials and that counting one recipe does not deduct stock.
- Test real keyboard and touch/click flows for item details, habitat details, quantity editing, dismissal, and focus return.
- Add focused automated coverage for requirement matching, deficit calculation, quantity validation, and backward-compatible persistence; reuse existing glossary coverage.
- Run `npm test`, `npm run build`, and `npm run format:check`; distinguish existing unrelated failures from regressions.
- Visually inspect the running app in-browser and record desktop/mobile evidence before declaring the implementation complete. The earlier live-page inspection failed with connection refused; the screenshot was the visual basis for the approved suggestions.

## Completion record

[Certain] Implemented in `src/dex/DexPage.tsx`, `src/styles.css`, and `src/persistence/store.ts`. Existing backups without `materialCounts` remain valid; invalid, negative, fractional, unsafe, and unknown-item counts are rejected on import.

[Certain] Browser validation used the local Ivysaur page at desktop and 390 px mobile. The Field of Flowers card displayed the habitat image, **8 × Wildflowers**, locations, time, weather, rarity, source, and a working habitat explanation. Setting 3 Wildflowers showed **You have 3 / 8 · Need 5 more** and survived reload.

[Certain] Automated validation passed: 55 tests, production build, and formatting for the edited files. The default shell's Node 14 cannot parse the installed Vitest release; checks passed using the workspace's bundled Node runtime.
