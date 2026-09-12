# Build Ideas: MVP concept and sample record

Status: interactive prototype for review, 12 September 2026. Not an application feature or implementation approval.

## Decision

The user selected “recreate a reviewed build” as the primary outcome. Build Ideas is an addition to the existing companion. Its job is Pokémon selection → suitable build → readable 2D layout → finished-item gathering → explicit built location. The first product library should contain three in-game-verified templates before expanding toward 15–20. AI assists internal content preparation; a human reviews every published template. Public screenshot reconstruction, canvas editing, substitutions, multilevel towns, and exact comfort scores are outside this MVP.

## Review artifact

Open `output/build-ideas/index.html` through a local web server. The sample record is `output/build-ideas/sample-build.json`. The UI uses a generated copy in `sample-data.js`. The small authoring helper regenerates both from the current catalog; it is not an importer or production pipeline.

The mock inherits the current cream and forest palette, Trebuchet body text, Georgia headings, focus treatment, and responsive layout from the application. It introduces a three-step guide rather than a new visual identity. No production routes, catalog records, notebook state, or app styles are modified.

## Sample: Flower camp

Original companion concept, not a transcription of a creator’s build. The proposed 5 × 5 board has four Wildflowers, two Plain stools, and one Campfire on assumed existing level ground. All seven placements use real catalog item IDs; counts are derived from those placements. Their one-cell footprints and coordinates are illustrative. Raw crafting requirements are deliberately absent because finished-item quantities do not establish craft batch yields.

Combee matches the Campfire’s Group activities and the Plain stool’s Wooden stuff. Eevee matches Group activities / Stone stuff on the Campfire and Soft stuff on the Plain stool. These are exact category overlaps in the catalog, not predicted happiness or proof of shared housing. Wildflowers do not gain a preference match through an inferred Nature-to-Lots-of-nature category conversion.

This sample is structurally complete as a prototype record, but is not a publishable, verified community blueprint. That distinction is stored in `publicationStatus`, per-field footprint status, and `review.publishable: false`.

## Evidence and the missing extraction

- [Serebii: Pretty flower bed](https://www.serebii.net/pokemonpokopia/habitatdex/prettyflowerbed.shtml), checked 12 September 2026, supports the four-Wildflowers requirement. It does not establish the full proposed layout, footprint sizes, group capacity, or comfort.
- The checked local `public/data/catalog.json` supplies identities, categories, and Pokémon preferences. Its version is pinned in the sample record.
- [CanStriking2668’s 5×5 gallery](https://www.reddit.com/r/Pokemon_Pokopia/comments/1t583yp/welcome_to_the_5x5_habitat_gallery/) links the creator’s [construction playlist](https://youtube.com/playlist?list=PL4lweZ0eQ3QR1Gq25o6CuYAqcIi_YUQkc). This remains a discovery candidate. No specific video, timestamps, or exact creator layout have been extracted; media reuse is not established. No creator image is copied into the prototype.

The next content task is to choose one exact tutorial, record the creator and reuse basis, map every required object and layer, and test recreation in game. It must not be marked reviewed merely because its JSON validates.

## Flow and states

1. **Choose Pokémon:** three sample choices; Eevee and Combee are selected initially. The single demo appears when any selection exists, and its rationale updates from selected Pokémon. Empty selection has a recovery instruction. This is not a finished recommendation ranking demonstration.
2. **Inspect build:** a read-only 5 × 5 diagram, selectable objects, three quantity rows, an item source, and expandable review evidence. Save advances to gathering without consuming inventory.
3. **Gather:** whole-number counts per item, clamped to the plan quantity, with explicit deficits. Clearing the field is allowed while editing; committing blank means zero in the demo. Location is required to record demo completion. Completion can be undone. Gathering all items never automatically marks the build complete.
4. **Persistence:** demo-only local browser storage, with template version recorded; counts and selection survive reload. Reload starts at selection, with the saved gathering step available. Storage failure is visible. Reset affects this demo namespace only.

## Publication gate for the actual MVP

A reviewed template requires an exact source or original authorship; media/reuse status; stable catalog IDs; confirmed item quantities; exact footprints and orientation; all layers and required ground/terrain; an explicit treatment of missing facts; and dated in-game recreation evidence. Record who reviewed each field and the game/catalog revision. A shopping list must derive from placed objects and separately recorded terrain requirements. Anything incomplete stays in the internal review queue.

Saved user plans must pin an immutable template version or snapshot. Library updates must not silently change a saved bill of items. Use catalog item IDs for aggregation, not display names. User gathering notes are independent of notebook inventory. Built location is explicit and editable. Future craft expansion needs same-source ingredients and verified yield, plus the user’s manually recorded recipe knowledge; missing learned marks must not be treated as proof a recipe is locked.

## What this review should decide

Does the three-step flow communicate enough to follow a build? Is the 2D diagram plus selectable item list useful? Does the gathering screen make partial progress concrete? If the flow is accepted, the next milestone is the first genuinely reconstructed and game-verified community template, followed by the detailed implementation plan.

## Verification performed

- Sample record: all placement IDs resolve to current catalog items; counts equal the seven placements; illustrative positions are unique; publication is blocked.
- Browser: select → inspect → save → gather; Campfire inspection shows its catalog details; direct quantity input updates the deficit immediately and survives reload; chosen location and completion survive reload; undo completion restores the incomplete state.
- Mobile: tested the real page in a 390px-wide iframe because the browser viewport override did not affect the background tab. The body client width and scroll width both measured 390px. Gathering controls and the three-step flow were inspected. Screenshot export scales the capture unusually, so it is supporting evidence rather than a pixel-perfect mobile golden.
- No in-game recreation was performed. No player tutorial was reconstructed. No production app tests/build were needed because production source is unchanged.
- Impeccable context and detector executables were unavailable (permission denied); existing project styling was inspected directly.

Independent UI review disposition: ship for concept review only. No material functional or copy mismatch found. Review-status labels were moved below headings after the review. Empty selection recovery and selectable object details also passed at 390px; source and gathering views measured no horizontal overflow. Full mobile visual quality and in-game validity remain outside the verified claims.
