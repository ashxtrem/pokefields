# Zone Planning implementation plan

Date: 2026-09-11
Status: Proposed implementation scope; no feature code implemented.

## 1. Product decision

Add **Zone Planning** after Housemates in the primary top bar:

**Pokédex → Habitats → Items → Housemates → Zone Planning**

The player should be able to look at their game and this map, recognize the same locations, decide where to build, and work through a settlement plan one district at a time.

Start with Withered Wasteland and an editable, researched starter settlement plan. Other regions appear only when their reference packages are ready. An unzoned starting option remains available. The default starter-plan choice is a recommendation from the discussion, not a separately confirmed user preference.

Keep the existing product responsibilities clear:

- Pokédex: Pokémon discovery and preferences.
- Habitats: habitat requirements, planned/built copies, and gathering.
- Housemates: compatible resident groups and housing requirements.
- Zone Planning: regional placement, district purpose, movement routes, and development order.

This plan authorizes no fictional geography. Recommendations about district placement are design decisions, even when the underlying terrain is verified.

## 2. Confirmed starting point

Code inspected during the discussion:

| Existing surface | Confirmed implementation | Consequence |
| --- | --- | --- |
| `src/App.tsx` | Four primary navigation entries and hash-based page rendering | Add a fifth section and dedicated routes |
| `src/ui/navigation.ts` | Section route memory and visit-scoped view state | Extend the existing navigation contract |
| `src/catalog/types.ts` | Areas are names; catalog contains Pokémon, habitats, kits, and items | Add a separate geographic reference package |
| `src/habitats/types.ts` | Build records have IDs, region, copies, location notes, status, and allocations | Link existing records; do not duplicate gathering data |
| `src/planner/types.ts` | Current housemate groups have IDs and residents, without spatial coordinates | Zone placement is a separate concern |
| `src/planner/engine.ts` | Legacy rectangular plot validation, maximum 200 × 200, home overlap checks | Do not use this engine as regional terrain validation |
| `src/persistence/store.ts` | Local Dexie notebook and backup validation | Extend persistence, migration, and backup validation |
| `src/progress/context.tsx` | Central updates and undo integration | Use shared progress infrastructure with scoped edits |

The current catalog has no regional coastline, elevation, buildability polygons, or calibrated map coordinates. Pokémon Center kit dimensions are null in the inspected catalog; external editor defaults must not silently replace those unknown values.

## 3. Research references and their limits

These references were inspected or retrieved on 2026-09-11. The observations below describe the source, not a completed geographic audit.

| Source | What it provides | Reliability and allowed use |
| --- | --- | --- |
| [Pokopia Guide interactive map](https://pokopiaguide.com/es/map) | Regional map, Pokémon Center/workbench markers, collectible locations; map visually inspected in-browser | Medium, provisional: reference candidate; exact scale and terrain fidelity remain unverified |
| [Displayed base image](https://pokopiaguide.com/images/maps/regions/withered-wasteland.png) | A 481 × 477 pixel top-down image | Pixel dimensions are confirmed; they are not block dimensions. Do not infer elevation or flat buildable land from a uniform color |
| [Serebii location guide](https://www.serebii.net/pokemonpokopia/locations/witheredwastelands.shtml) | Regional overview and gameplay/location reference | Supporting reference; not a surveyed construction map |
| [Bulbapedia region page](https://bulbapedia.bulbagarden.net/wiki/Withered_Wasteland) | Describes regional connections and landmarks | Supporting reference; cross-check directional claims against map/game evidence |
| [Community rough map](https://www.reddit.com/r/Pokopia/comments/1tfowba/rough_withered_wasteland_map/) | Whole-region planning sketch | Low for original geography: author explicitly acknowledges inaccuracies and previous terrain changes |
| [Community map sizes](https://www.reddit.com/r/Pokopia/comments/1row28a/pokopia_maparea_sizes/) | Reports Withered Wasteland as 240 × 240 blocks | Unverified measurement; do not ship as an exact grid scale |
| [Existing map editor](https://pokopia-companion.com/en/planner) | Terrain brushes, objects, labels, grid, undo/redo, saving | Interaction reference, not authority for map scale or building dimensions |

### Research gate before geographic authoring

1. Compare the candidate map against independent game screenshots or footage. Shared imagery across websites is one reference, not independent corroboration.
2. Record source URL, author/provider, capture/retrieval date, game version if known, progression state, and whether terrain was modified.
3. Verify orientation through recognizable landmarks and regional exits. Do not declare north merely because it is the top of an image.
4. Identify coastline, water, major terrain edges, routes, entrances, landmarks, and surface/underground distinctions. Unknown geometry remains unknown.
5. Establish scale only through reproducible block measurements and multiple control points across the map. Record measurement method and tolerances.
6. Check asset provenance and reuse terms before bundling any third-party image. Attribution alone does not establish permission. If reuse is unavailable, obtain a usable player-provided reference or create an independently evidenced representation with appropriate provenance.
7. Version the accepted reference. Do not treat a historical starting map as the player's current terrain.

**Exit condition:** a reviewable reference map, evidence register, orientation decision, scale status, uncertainty list, and usable asset provenance. If exact scale is unavailable, regional zoning may proceed with explicitly approximate boundaries; block-accurate placement stays unavailable. If recognizable geography itself cannot be established, complete the interface against labeled fixtures but do not release a fictional regional plan.

## 4. Evidence contract

Every geographic feature and source-based claim supports:

- **VERIFIED:** supported by cited evidence sufficient for that specific claim.
- **INFERRED:** interpretation from references; explanation required.
- **DESIGN RECOMMENDATION:** proposed zoning, paths, landscaping, or development sequence.

Store evidence per claim/feature, not just one badge for the entire map. A verified landmark does not verify neighboring zone boundaries or dimensions. User-edited boundaries are personal design decisions. User-recorded terrain is identified as such and retains its reference date.

Use descriptive reliability ratings in the source drawer with a reason. Do not fabricate numerical confidence scores. Unknown dimensions display “Not measured”; approximate dimensions show the approximation beside the number.

## 5. First-release scope

### Included

- One evidenced regional base map and one optional starter zoning template.
- Pan, zoom, fit-to-region, compass after orientation verification, legend, and layer controls.
- Create, rename, reshape, and delete polygon zones; undo completed edits.
- Zone purpose, notes, boundary description, build suggestions, status, and phase.
- Proposed path polylines with main road, secondary path, local path, and nature trail categories.
- Preserve areas, expansion reservations, and evidence-backed terrain constraints.
- Linking existing habitat build records and housemate groups to zones.
- Planned / In progress / Built zone status, independent of linked record status.
- Phase list with dependencies and map highlighting.
- Local saving, notebook backup round-trip, and a printable regional overview.
- Desktop map workspace and usable mobile map/list/detail views.

### Deferred

- Full terrain sculpting, voxel reconstruction, and multi-level building simulation.
- Automatic screenshot interpretation, game-save import, and live game synchronization.
- Automatic optimal zoning or claims that a recommended layout is uniquely correct.
- Exact block layouts before scale and local terrain are measured.
- New material consumption/reservation rules or automatic changes to existing gathering counts.
- Simultaneous detailed designs for every building or every district.
- Cloud sharing/accounts and support for all regions at launch.

## 6. Screen and interaction design

### Navigation and routes

- `#/zones`: entry and region selection; first ready region is Withered Wasteland.
- `#/zones/:regionId`: regional map and plan.
- `#/zones/:regionId/:zoneId`: selected zone with direct-link and Back support.
- Use stable region IDs with explicit catalog-name mappings. Preserve the catalog's existing `Withered Wastelands` value while accepting the singular display/source name.
- Add the section to parsing, active navigation, last-route restoration, and route tests.
- Make primary navigation horizontally scrollable on narrow screens; keep the selected tab visible and keyboard reachable. Verify the existing four destinations remain easy to reach.

### Desktop workspace

- Compact toolbar: region, plan name, saved state, layers, edit mode, fit map.
- Main map: the largest surface, quiet reference styling, translucent zones, labels, and route hierarchy.
- Side panel: zone list when nothing is selected; selected zone details otherwise.
- Phases panel: ordered development steps, dependencies, and “Show on map.”
- Sources/uncertainties drawer: supporting evidence without covering routine planning controls.

### Mobile workspace

- Map and zone-list views share selection and the current plan.
- Selected-zone details open in a bottom sheet with a full-height expansion option.
- Explicit Browse / Edit modes prevent accidental reshaping while panning.
- Touch targets are at least 44 CSS pixels. Editing supports tap-to-add points, a visible Finish action, Cancel, and Undo; it must not depend on hover, right click, or tiny drag handles.
- Normal page scrolling remains available outside the map. Pointer capture is released on cancel, gesture interruption, and mode changes.

### Editing behavior

1. Browse is the default. Clicking a zone selects it without changing it.
2. Enter Edit explicitly. Show the pending shape separately until committed.
3. Finish validates the geometry; Cancel restores the prior shape.
4. Commit one undo entry per completed gesture/operation, not per pointer movement.
5. Primary land-use zones cannot overlap one another in the same plan; shared-purpose districts use multiple purpose tags. Paths, preserve constraints, and landmark overlays may intersect zones.
6. Clearly evidenced constraints produce contextual warnings. Unknown terrain must never be treated as approved buildable land. Advisory warnings do not masquerade as game-engine validation.
7. Removing a zone removes its associations from this plan only; it does not delete habitats, homes, residents, or shopping progress.

## 7. Starter settlement content

Do not assign actual district coordinates until the research gate passes. Investigate these categories and include only those supported by the terrain and the player's needs:

- Civic area around the documented Pokémon Center location.
- Residential and custom habitat clusters.
- Workshop/crafting space.
- Farming/orchard space.
- Waterfront or aquatic habitats where access and terrain are established.
- Parks, preserved terrain, and future expansion.

Every included zone needs:

- Stable ID, name, purposes, polygon, and recognizable boundary description.
- Terrain suitability explanation and evidence references.
- Approximate extent or verified dimensions with measurement provenance.
- Proposed buildings/home types, Pokémon suggestions, and landscaping approach.
- Route connections, neighboring zones, and expansion opportunities.
- Hut Kit versus custom-build rationale; custom homes are valid first-class suggestions.
- Development phase, dependencies, and unknowns to check in-game.

Keep preference matching explainable. Existing habitat availability and Pokémon preferences do not establish that a particular patch of land satisfies those requirements. Do not claim undocumented custom-home capacity or exact furnishing rules.

The in-game development sequence is content to derive from the accepted geography. It is separate from the engineering milestones below. Preserve access and resolve essential dependencies before recommending decorative expansion. Label this sequence as a recommendation.

## 8. Data model and persistence

### Read-only reference package

Proposed `RegionReference` fields:

- `id`, `catalogArea`, `displayName`, `revision`, `checkedAt`.
- Base-map asset and provenance/reuse record.
- Reference coordinate bounds, orientation status, and optional scale calibration.
- Landmarks, terrain/constraint features, route connections, and evidence records.
- Optional `starterTemplate` with zones, paths, phases, and explanatory content.

Use image/reference coordinates with an explicit origin. Store geometry independently of viewport zoom or CSS size. Uncalibrated coordinates are never displayed as block measurements. A later scale calibration is an explicit transform with a revision, not a reinterpretation of saved numbers.

### Personal planning data

Add an optional versioned `zonePlanning` field to `SaveState`, initially empty for old notebooks:

- `schemaVersion` and `plansByRegion` (one active plan per supported region in v1).
- Plan ID, name, region ID, reference revision, template revision, timestamps.
- Zones: ID, names/purposes, geometry, boundary notes, status, phase ID, recommendations, and evidence references.
- Paths: ID, category, polyline, notes, and phase ID.
- Phases: ID, title, order, dependencies, and explanation.
- Associations with stable source IDs, plus small descriptive snapshots for unresolved references.

Persist the copied starter plan only when the user chooses “Use this plan”; previewing it must not silently create progress. Template updates never overwrite personal edits. Reference changes require explicit review and a preserved previous revision; do not silently move zones to a changed map.

### Existing record links

- Habitat association: build record ID and assigned copy count. Permit splitting a multi-copy record across zones, with total assigned copies capped at the current record count within the regional plan.
- A habitat build's explicit region must match the plan. Unspecified/mismatched regions require resolution; do not silently rewrite the original record.
- Housemate association: group ID plus resident/kit snapshot. A group can be assigned to one zone per active regional plan; flag duplicate assignments across regional plans for review.
- Regenerated groups, split/deleted habitat records, and changed copy counts mark links for review. Do not guess a replacement from similar names or resident order.
- Keep material counts and allocations in their existing records. Zone panels may display linked requirements but cannot create a second inventory balance.
- Marking a zone Built never automatically marks every linked habitat built or consumes materials.

### Backup and undo requirements

- Validate finite coordinates, bounds, nondegenerate/non-self-intersecting polygons, unique IDs, supported enums, dependency cycles, and association counts.
- Bound point counts, text lengths, and total payload size with documented limits.
- Missing old fields migrate to an empty planner. Unsupported newer planning payloads must be preserved for recovery and shown as unavailable, not discarded.
- Validate before replacing a notebook; invalid imports must not partially overwrite current progress.
- Preserve unknown source/catalog references as reviewable snapshots.
- Integrate scoped undo through `src/crafting/undo.ts` and progress context as required by the existing implementation. Undoing a zone edit must not roll back an unrelated habitat or crafting update.
- Save map geometry/progress permanently; keep zoom, pan, layer visibility, expanded panels, and temporary selection in visit-scoped view state, with URL selection taking precedence.

## 9. Implementation structure

Suggested new modules:

| Path | Responsibility |
| --- | --- |
| `src/zones/types.ts` | Reference, plan, evidence, zone, path, phase, and association types |
| `src/zones/references.ts` | Supported region package loading and catalog-name mapping |
| `src/zones/geometry.ts` | Coordinate conversion and geometry validation |
| `src/zones/validation.ts` | Saved payload and dependency validation |
| `src/zones/migration.ts` | Loading older or unsupported planning data safely |
| `src/zones/associations.ts` | Existing build/group links and reconciliation |
| `src/zones/ZonePlanningPage.tsx` | Region entry and workspace coordination |
| `src/zones/RegionMap.tsx` | SVG reference overlays, pan/zoom, selection, editing |
| `src/zones/ZonePanel.tsx` | Zone details, progress, associations, editing controls |
| `src/zones/DevelopmentPhases.tsx` | Phase dependencies and map highlighting |
| `src/zones/SourcePanel.tsx` | Evidence, scale, revision, and uncertainty presentation |
| `public/data/zones/` | Approved geographic reference packages/assets |
| `docs/research/zone-planning/` | Source audit, calibration notes, geographic review evidence |

Prefer SVG overlays over a raster reference for the small number of region-scale zones and paths. Keep pointer updates local during gestures and commit durable state at the end. Do not introduce a full geographic map library without an identified need. This is a proposed implementation choice, not a measured performance result.

Extend `src/App.tsx`, navigation, persistence/progress, styles, scoped undo, backup summaries, and offline asset generation. Load regional assets on demand and include the supported reference in the existing offline build workflow. Test cached/offline behavior rather than assuming a remote image remains available.

## 10. Engineering milestones

### A. Geographic reference and zoning proposal

- [ ] Complete the source/evidence and asset provenance audit.
- [ ] Establish orientation and scale status.
- [ ] Document landmarks, constraints, routes, and uncertainty.
- [ ] Produce one recognizable regional zoning overlay with rationale and proposed in-game phases.
- [ ] Review it before authoring detailed individual-zone layouts.

Deliverable: reference package and reviewable master zoning proposal. No unsupported exact dimensions.

### B. Navigation and read-only workspace

- [ ] Add routes and responsive top-bar entry.
- [ ] Render map, zones, paths, legend, sources, and phases.
- [ ] Implement desktop/mobile selection, list access, and navigation continuity.
- [ ] Include missing-map, unsupported-region, and offline states.

Deliverable: an explorable regional proposal with visible evidence.

### C. Personal plan editing and saving

- [ ] Add template adoption and unzoned starting option.
- [ ] Implement polygon/path editing, validation, cancel, and scoped undo.
- [ ] Persist plans with migration and validated backup import/export.
- [ ] Add progress, notes, phase editing, and dependency validation.

Deliverable: personal edits survive reload and backup round-trip.

### D. Existing planning integration

- [ ] Link habitat copies and housemate groups.
- [ ] Handle source changes, region mismatch, removed records, and unresolved links.
- [ ] Show existing requirements without duplicating allocation state.
- [ ] Add printable regional overview with legend, revision, evidence labels, and phase order.

Deliverable: spatial planning connects to the player's existing notebook.

### E. Verification and release

- [ ] Complete behavioral tests and production build using the project's Node 22 environment.
- [ ] Run browser checks on desktop and mobile, including real pointer/touch editing.
- [ ] Validate geography against the recorded references separately from UI tests.
- [ ] Record actual checks, remaining limitations, and source revision in a verification document.

Deliverable: tested regional planning feature. Exact zone/build layouts remain a later, separately selected slice.

## 11. Acceptance checks

### Geography and evidence

- A reviewer can identify the same key landmarks and regional connections on the reference and zoning overlay.
- Every factual map feature has traceable evidence or an explicit inferred designation.
- No field displays pixels or unverified community measurements as exact blocks.
- Uniform map colors are not automatically classified as flat/buildable land.
- Sources and version/progression limitations remain accessible offline with the packaged reference.

### Automated behavior

- Old notebook loads unchanged; new planning data survives export/import.
- Invalid geometry and cyclic phase dependencies cannot corrupt saved plans.
- Cancel leaves the prior plan intact; one undo reverses one committed edit.
- Undo preserves unrelated notebook changes made after the zone edit.
- Habitat copy splits cannot over-assign; record changes produce review states.
- Deleted/regenerated source records retain meaningful unresolved-link context.
- Route parsing, malformed/unknown IDs, Back, and section resumption behave predictably.

### Browser proof

- At desktop and 390px mobile widths, all five primary tabs are reachable without document overflow.
- Open Zone Planning, select a zone, visit a linked habitat/home, and return with the map position and panel restored during the visit.
- Create and reshape a zone, draw a path, cancel another edit, undo, reload, and verify the committed outcome.
- Use touch-style interactions and keyboard-accessible zone controls; verify there is no accidental edit during Browse-mode pan.
- Test an old backup, a current round-trip backup, missing map asset, unavailable region, and unresolved association.
- Verify readable labels, non-color evidence/status cues, focus visibility, reduced motion, and map/list equivalence.
- Inspect the printed overview for clipped geometry, missing legend, and misleading dimensions.

### Stop condition for this implementation

The first release is complete when the player can recognize the evidenced region, adopt or create a plan, edit district boundaries and paths, connect existing notebook records, follow phases, and recover the plan after reload/import. Tests and builds alone do not establish geographic accuracy or successful map interaction.

## 12. Follow-up: one zone at a time

After the regional master plan is presented, ask which zone the player wants to develop first. For that selected zone, gather any missing local terrain measurements and produce a separate build layout with paths, plots, entrances, furniture, vegetation, lighting, and open space. Enable block/grid representation only where measurements support it. Do not expand automatically into detailed designs for every zone.
