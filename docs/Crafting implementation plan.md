# Crafting implementation plan

[Certain] Status: planning only, prepared 2026-09-10 against catalog `2026-09-09.5`. This document **replaces** the earlier crafting calculator plan of the same name. It does not authorize implementation, deployment, or a commit.

[Certain] Evidence labels: **[Certain]** identifies inspected repository facts or explicit requirements. **[Likely]** identifies a proposed decision, not an existing capability or a verified game fact. Section 13 defines how a `[Likely]` is promoted.

## 1. Outcome and boundaries

[Certain] The Crafting tab is a **recipe directory that answers two questions the game does not**: how a recipe is unlocked, and where each of its materials comes from. The concept is `output/crafting-guidance-concept.html`, built on real catalog records.

[Certain] Decision record — why this replaces the calculator plan:

- The game's own crafting screen already shows the ingredient list, the required counts and what the player holds. A companion calculator competes with the screen the player is looking at, using a staler copy of the same numbers.
- The previous plan's own audit reported `calculableRecipes: 0 / 883`: yield is unknown everywhere and ingredient basis is unknown everywhere, so nothing quantitative could be computed honestly anyway.
- Cutting the calculator removes yield, ingredient basis, quantity units, list entries, aggregation, `materialCounts` semantics and the whole shared-demand surface — the most expensive and least certain third of that plan.

[Certain] Required first-version behavior:

- One **Crafting** primary-navigation entry after Housemates, retaining Pokédex → Habitats → Housemates order.
- A searchable recipe directory: name search, category filter, and a **Hide learned** filter.
- Per recipe: **How to learn this recipe** — recorded unlock guidance with its source, or **Not yet documented**, which must never be filled in from where the finished item can be found.
- Per recipe: **Ingredients and where they come from** — documented counts as recorded, each ingredient expandable to its recorded acquisition locations.
- A manual **learned** mark, presented as a filter lens only: durable, reversible, never inferred from discoveries, materials or anything else.
- A one-way link from any craftable item already shown in Habitats, Housemates or a glossary term to its recipe page.
- Old-save migration, import/export, session navigation continuity, accessibility and real mobile/desktop verification.

[Certain] Out of scope for version one: crafting quantities and targets, a crafting list or queue, combined material demand, recorded owned-material tracking, output yield, ingredient basis, craftable-now status, specialty-to-housemate matching, recursive dependency expansion, in-game synchronization, and any inference of learned status.

[Likely] Deferred with a recorded reason: **specialty guidance** (only 8 of 883 records carry a specialty and all 8 come from the cooking table, so displaying it implies "no helper needed" for 875 recipes) and **material-quantity arithmetic** (see the decision record above). Both may return once section 3 raises coverage.

## 2. Inspected baseline

[Certain] Recomputed from `public/data/catalog.json`. These describe stored fields, not verified game coverage.

| Measurement | Observed | Consequence for this plan |
| --- | ---: | --- |
| All items | 1,755 | Items are not synonymous with recipes |
| Items with a nonempty `recipe` | 883 | The directory population |
| Recipes with `recipeLocation` (unlock text) | 141 | **16%** — the gap this plan exists to close |
| Items with `recipeLocation` but no ingredients | 2 | Audit records, not directory entries |
| Items labelled "Craft from recipe" with no `recipe` | 3 | Dead-end records; exclude with a reason |
| Kind signal in `locations` | 708 craft / 34 cook / 141 neither | Kind is labelled only where a signal exists; never inferred from a style category |
| Items with a nonempty `locations` | 1,388 | The material-sourcing population |
| **Ingredient occurrences whose material has recorded locations** | **1,324 / 1,360 (97.4%)** | The materials half of the feature is already shippable today |
| Ingredient occurrences resolving to a unique item | 1,359 exact + 1 alias, 0 ambiguous | Identity is effectively solved |
| Cooking recipes whose ingredient counts are importer defaults of `1` | 34 | Counts are shown as recorded, never multiplied |

[Certain] **The unlock gap is at least partly an importer omission.** `scripts/import-data.mjs` fetches only `cooking.shtml`, `building.shtml`, `items.shtml` and five category index pages ([import-data.mjs:523](../scripts/import-data.mjs), [import-data.mjs:546](../scripts/import-data.mjs)), and the category pages only to discover item IDs from images. It **never fetches an individual item page** — `item.source` at [import-data.mjs:72](../scripts/import-data.mjs) is a constructed URL string, not a page we open — and it **never fetches `crafting.shtml`**. Every unlock string we hold comes from PokopiaAPI's `recipeLocation` at [import-data.mjs:573](../scripts/import-data.mjs), which is exactly why coverage is 141. The earlier plan's spot check found Serebii's live Plain stool page carrying a Recipe section with unlock text while our record has none. That is one page: it proves the importer drops guidance that exists upstream, **not** that all 742 missing records exist upstream. How much of the gap is recoverable is an output of section 3, not an assumption of it, and the audit must report recovered, confirmed-absent and unreachable separately.

[Certain] Supporting facts already verified: `scripts/bake-images.mjs` bakes one icon per catalog item, so recipe and material imagery needs no build change; `scripts/build-offline.mjs` precaches only `/`, `/data/catalog.json` and hashed assets, and hash routes resolve from `/`, so a new route needs no service-worker change; images under `/images/` are runtime-cached on first view, so a recipe never opened online renders its text fallback offline.

## 3. Unlock guidance extraction

[Likely] This is the highest-value work in the plan and it is bounded scraper work against a source already approved and already attributed.

1. Extend `scripts/import-data.mjs` to fetch `https://www.serebii.net/pokemonpokopia/crafting.shtml` and the per-item page for every recipe candidate, reusing the existing three-at-a-time HTML limiter and the `.cache/sources` cache. A refresh must deliberately invalidate that cache; the same URL does not prove freshness.
2. Parse the item page's Recipe section for unlock text and for the ingredient list. Where the page's ingredients disagree with the PokopiaAPI record, keep the existing values and record the disagreement — do not merge a bundle across sources.
3. Store guidance as **field-scoped evidence, not one string**. A single `{ text, sourceUrl, retrievedAt }` cannot express the alternatives, conflicts and per-field provenance the rest of this plan renders. The shape must carry:

   | Field | Contract |
   | --- | --- |
   | `unlock.methods[]` | Zero or more alternative ways to learn the recipe, each with its own `text`, `provider`, `sourceUrl`, `retrievedAt`. Zero methods means undocumented, never "no method exists" |
   | `unlock.conflicts[]` | Values that disagree, each retaining its own evidence, so both sides render with their sources rather than one being chosen |
   | `ingredients[].countEvidence` | Where each count came from: PokopiaAPI record, Serebii item page, or **`importer-default`** for the 34 cooking recipes whose counts are literal `1` values the importer wrote, not observed data |
   | `ingredients[].locationEvidence` | Provenance for the material's acquisition locations, which the UI displays as fact and which currently arrive unattributed from the PokopiaAPI `locations` field |
   | `kindEvidence` | The craft/cook signal and where it came from; 141 records have no signal at all |

   Legacy `recipeLocation` stays in place for existing consumers. Absent evidence means absent; never synthesize a record to fill the shape.
4. Never promote a `locations` line into unlock guidance because it mentions a shop, region or request. Acquiring the finished item is a different fact from learning its recipe, and conflating them is the single most likely way this feature becomes wrong.
5. Where `crafting.shtml` and an item page disagree, keep both and render the entry as conflicting rather than choosing by source order.
6. Re-emit `docs/research/crafting-audit.json` with before/after unlock coverage, per-source scope, retrieval dates and conflicts, splitting the previously missing 742 into **recovered**, **confirmed absent upstream** and **not reachable** so the residual gap is described rather than assumed. Every coverage figure quoted in this document, the README or a release note is generated from that report, never typed by hand.

[Certain] Licensing: the recorded decision `D-LIC-01` (`docs/research/crafting-licensing.md`) stands — no Bulbapedia-derived values are bundled. This plan does not need them: Serebii is already the project's factual reference for habitat requirements, item associations and building data, and is attributed in `README.md`.

[Likely] Coverage is a reportable outcome, not a release gate. Recipes without recorded guidance ship reading **Not yet documented**, and the release note states the measured figure.

## 4. Materials sourcing

[Likely] Each ingredient row shows the documented count and the resolved material's recorded `locations`. Rules:

- Show counts exactly as recorded. Never multiply, total or describe them as exact.
- Summarize on the row and give the full list on expand: the mock's Lumber has seven areas. Proposed summary is a count of natural areas plus a note when a shop unlock or an action ("Smelt Pokémetal in the furnace", "Destroy fabric on the ground") is present, because those are the lines players cannot guess.
- Each location list carries its provenance from `locationEvidence` and is attributed in the UI, exactly as unlock guidance is. Locations are displayed as fact today with no source shown; that is the same overstatement this plan corrects elsewhere.
- The 34 cooking recipes carry `importer-default` counts. Their ingredient rows must say the count is not a recorded per-craft figure rather than presenting `× 1` as documented.
- 36 of 1,360 ingredient occurrences have no recorded material locations; those rows read **Not yet documented** rather than being hidden.
- An ingredient that does not resolve to a catalog item shows its raw label plus "Item match not yet documented." and no location list.

## 5. Identity and resolution

[Certain] `src/dex/glossary.ts` resolves display names permissively — `resolveItem` prefix-matches in either direction for labels longer than three characters ([glossary.ts:143-146](../src/dex/glossary.ts)) — so `Iron ore` and `Iron ornament` can resolve to each other. That is fit for a best-effort label and unfit for linking a material to its locations.

[Likely] Keep the existing `src/crafting/identity.ts` contract: unique exact normalized-name matches plus reviewed aliases only, with `aliases.json` retaining the one reviewed correction (`light-brown rock`). **Fix its cost**: build one `Map<normalizedName, itemId>` per catalog instead of filtering all 1,755 items per ingredient. The current implementation costs a measured 378 ms per full pass on a development machine and that pass runs at least twice on every cold start.

## 6. Saved state

[Likely] The crafting payload holds one thing:

```
crafting: { version: 2, learnedRecipeIds: string[] }
```

[Certain] **The version must change.** The shipped version-1 reader hard-requires the removed field — `normalizeCraftingState` fails when `!Array.isArray(raw.entries)` (`src/crafting/migration.ts`) — so a `{ version: 1, learnedRecipeIds }` payload is rejected by the very reader that claims to understand version 1. Reusing the number would mean two incompatible shapes sharing it, and an older build reading the new save would reject the whole notebook (see the load-path defect below). Version 2 with an explicit version-1 migration costs nothing and removes the ambiguity.

- Missing payload means no marks. Never infer a mark from discoveries, materials or plans.
- Marks referencing a recipe absent from the catalog are retained as unavailable records for export and review, excluded from the learned count, and never silently deleted.
- Keep transient search, filters, selection and scroll out of the payload; they belong in `useViewState`.
- `materialCounts` stays in `SaveState` with its existing validation because released backups may contain it, but **no version-one surface reads or writes it**. Document it as unused rather than removing it and silently dropping player data.

[Certain] Two defects in the current implementation must be fixed as part of this work:

- [progress/context.tsx:82](../src/progress/context.tsx) — `normalizeLoadedState` calls a normalizer that throws on any malformed or newer-version payload; the throw is swallowed by `readState().catch`, which reports "Local storage could not be opened" and leaves `ready` false forever. A notebook written by a later version, a case the code explicitly anticipates, locks the player out of the entire notebook. **The load path must quarantine an unreadable crafting payload and keep the rest of the notebook usable**; strict rejection belongs only in `validateBackup`, where the player can decline the import.

  [Likely] Quarantine must **retain the raw payload**, not merely skip it. Store it verbatim under `craftingQuarantine: { raw, reason, quarantinedAt }`, carry it through every subsequent save and through export, and never overwrite it with a later quarantine of the same payload. Without that, the first write after a quarantined load destroys the data the quarantine existed to protect — including a version-3 payload a newer build could still read. Surface it in the notebook dialog as an unavailable record with its reason, and clear it only when a build successfully reads it or the player explicitly discards it.
- [progress/context.tsx:168](../src/progress/context.tsx) — `undo()` shifts the snapshot off the stack before attempting the scoped undo and, when the undo is refused, returns without restoring, so the refused action is lost from history and the next Undo reverts a different action than the banner named.

[Likely] Scoped undo is retained for the learned toggle: restore only `crafting`, refuse when a later crafting edit is in the way, and leave the entry on the stack when refused.

## 7. Disposition of the existing implementation

[Certain] A calculator implementation exists in the working tree (16 modules under `src/crafting/`, two test files, an audit script, enrichment and alias data). This plan does not start from an empty directory.

| Module | Disposition |
| --- | --- |
| `identity.ts`, `data/aliases.json` | **Keep**, with the Map index from section 5 |
| `catalog.ts` | **Keep, simplified** — drop `Verified<T>` minting, yield, basis and `calculable`; keep normalization, kind labelling, conflicts, snapshot-free recipe shape |
| `types.ts` | **Keep, reduced** to recipe, ingredient, unlock, conflict and the learned payload |
| `search.ts` | **Keep**, minus the craftable filter; add the unlock-status sort |
| `CraftingPage.tsx`, `RecipesPanel.tsx`, `RecipeDetail.tsx` | **Keep as the shell**, rebuilt against the concept: guidance first, ingredients expandable, learned as a lens |
| `list.ts`, `materials.ts`, `CraftingList.tsx`, `CraftingMaterials.tsx`, `QuantityField.tsx` | **Delete** — every one exists only for quantities |
| `migration.ts` | **Rewrite** to the section 6 payload plus the quarantine behavior |
| `undo.ts`, `useCrafting.ts` | **Keep**, with the refusal fix |
| `data/enrichment.json` | **Repurpose** from yield/basis overlay to reviewed unlock corrections |
| `scripts/audit-crafting-data.mjs` | **Keep**, re-aimed at unlock and material-location coverage |
| `tests/crafting.test.ts`, `tests/crafting-persistence.test.ts` | **Prune** the quantity, aggregation, craftable and mode suites; keep identity, conflicts, learned marks, migration, undo isolation and domain separation |
| `glossary.ts` change | **Keep** — it converged item terms on the normalized recipe; verify it still renders identically after `catalog.ts` is simplified |

[Certain] Existing local saves may hold the calculator payload. Migrating it by keeping `learnedRecipeIds` alone **loses marks**: `normalizeCraftingState` strips a learned ID whose recipe is absent from the catalog out of `learnedRecipeIds` and records it as `orphans[].learned = true` (`src/crafting/migration.ts`), so a mark on a retired or renamed recipe survives *only* inside `orphans`.

[Likely] Version-1 → version-2 migration therefore:

- **Merges** `learnedRecipeIds` with every `orphans[].recipeId` whose `learned` is true, de-duplicated, before anything is dropped. An orphaned mark stays an unavailable record under the section 6 rules; it is never silently deleted.
- **Preserves** the retired quantity data — `entries`, `orphans[].entries` and their snapshots — verbatim in `craftingLegacySnapshot`, exported with the notebook, following the `shoppingLegacySnapshot` precedent already in `SaveState` for the checkbox-to-quantity migration. A notice is not a substitute for keeping the data: the player cannot recover what a notice describes.
- **Never fails the load** because of either. A legacy payload that cannot be parsed goes to `craftingQuarantine` rather than blocking the notebook.
- Retains the snapshot until an export has demonstrably round-tripped it, matching how the shopping migration retired its own legacy data.

## 8. Navigation and interface

[Certain] Routes already exist: `#/crafting`, `#/crafting/recipe/:recipeId` in `src/ui/navigation.ts`, with `hasRecipe` wired into remembered-route availability in `src/App.tsx`. `#/crafting/list` must be removed with the list.

[Likely] Directory: search, category select (existing catalog categories plus **Uncategorized**), and a **Hide learned** toggle. Each row shows icon, name, categories, and an unlock-status chip reading **Unlock recorded** or **Not yet documented**. Show the filtered count, the total, the recorded-guidance count and the learned count together, so coverage is visible rather than implied.

[Likely] Default order places recipes with recorded guidance first. Until section 3 lands, dex order would open the tab on a screen of "Not yet documented"; make the ordering control visible so the choice is the player's.

[Likely] Detail order: identity → **How to learn this recipe** → **Ingredients and where they come from** → learned checkbox → source link. The unlock block states *why* it is empty when it is empty ("Unlock guidance has not yet been documented in this companion. It is not guessed from where the finished item can be found.") — the app can only speak for its own records, never for every source. Conflicting guidance renders as a conflict with both values, never a chosen one.

[Likely] Mobile shows the list, then a dedicated detail view with a visible **Back to recipes** control, using the same route and selection as desktop.

## 9. Accessibility, mobile and performance

[Likely] Real links for route changes with `aria-current`; every search, filter, learned control and expandable ingredient labelled with its recipe or material context. Ingredient disclosure is keyboard operable and its expanded state announced. Touch targets ≥44 px, visible focus, no hover-only path, status conveyed by text as well as color, reduced-motion honored.

[Likely] Toggling a learned mark under **Hide learned** removes the row: announce it, keep a usable focus target and offer Undo. Verify 360 px, 390 px, desktop ≥1280 px and 200% zoom.

[Likely] Build the recipe list once per catalog behind a memo, with the Map index from section 5. Profile 883 rows before adding a rendered-result window; add no virtualization dependency without evidence. Lazy-load material images and wrap long location strings and source links.

## 10. Phases and exit evidence

### Phase 1 — Unlock extraction

- [ ] Extend the importer per section 3; emit the refreshed catalog and audit report.
- [ ] Fixture-based parser tests, including a page with no Recipe section and a page that disagrees with the API record.
- [ ] Exit evidence: before/after unlock coverage generated from the audit; conflicts retained rather than resolved by source order; no `locations` line promoted into guidance; cache invalidation demonstrated.

### Phase 2 — Domain and state

- [ ] Simplify `catalog.ts`/`types.ts`, add the Map index, rewrite `migration.ts`, delete the quantity modules per section 7.
- [ ] Fix both `progress/context.tsx` defects from section 6, with tests for the quarantine path and the refused-undo path.
- [ ] Exit evidence: pruned suites pass; a version-1 save with a mark held only on `orphans[].learned` migrates with that mark intact and its quantity data in `craftingLegacySnapshot`; a notebook carrying an unreadable payload still opens with the rest intact and the raw payload survives later saves and an export; a refused undo leaves the stack unchanged.

### Phase 3 — Directory and detail

- [ ] Rebuild the page, panel and detail against the concept; add the unlock chip, ordering control, ingredient disclosure and material summaries.
- [ ] Add the one-way link from habitat requirements, home furnishings and glossary terms to a craftable item's recipe.
- [ ] Exit evidence: direct links, session return, mobile list/detail navigation and learned-filter transitions verified in a browser; a glossary item term and its recipe page state the same facts.

### Phase 4 — Notebook and verification

- [ ] Update notebook export/import summaries and copy for the reduced payload; migrate calculator-era saves per section 7.
- [ ] Run tests, typecheck and build under Node 22 (`.node-version`); `npm test` fails on older Node.
- [ ] Verify offline reload, missing-image fallback, storage-failure feedback and a real export/import round trip in a clean profile.
- [ ] Update `README.md` and `docs/navigation-ux.md`; `README.md` currently references `docs/verification.md`, which does not exist.

## 11. Acceptance scenarios

| Scenario | Required observable result |
| --- | --- |
| Initial notebook | No inferred marks; every recipe reads Not marked learned |
| Recorded guidance | A recipe with recorded unlock text shows it with its source link and retrieval date |
| Missing guidance | A recipe without it reads Not yet documented and explains why; no `locations` line appears as unlock guidance |
| Conflicting guidance | Both values render as a conflict; neither is chosen |
| Material sourcing | An ingredient expands to its recorded locations, including shop unlocks and actions; a material without locations reads Not yet documented |
| Unresolved ingredient | Raw label shown with "Item match not yet documented." and no location list |
| Mark and undo | Mark learned, see counts change, undo, reload, and find the restored state durable |
| Undo isolation | Mark learned, change unrelated progress, undo the mark; the unrelated change survives |
| Refused undo | When a later crafting edit blocks the undo, the action is explained and the undo entry is still available |
| Hide learned | Marking a visible recipe removes the row with an announcement, a usable focus target and Undo |
| Combined filters | Name, category and Hide learned intersect; clearing restores; the empty state is actionable |
| Cross-domain link | A craftable habitat requirement links to its recipe and changes no saved state |
| Unreadable payload | A notebook whose crafting payload cannot be read still opens, with discoveries, habitats and plans intact and the problem explained |
| Calculator-era save | Marks in `learnedRecipeIds` **and** marks carried on `orphans[].learned` both survive the version-1 to version-2 migration; retired quantity data is preserved in `craftingLegacySnapshot` and appears in an export; nothing else changes |
| Quarantined payload | A notebook with an unreadable or newer crafting payload opens; the raw payload survives several subsequent saves and a full export, and is described in the notebook dialog |
| Version guard | A version-1 payload migrates; a version-2 payload loads unchanged; a version-3 payload is quarantined, not discarded |
| Conflicting counts and locations | An ingredient row shows its count provenance, labels the 34 cooking recipes' counts as importer defaults rather than recorded figures, and attributes its location list |
| Old backup | A pre-crafting backup imports with empty marks and every other field preserved |
| Export round trip | Download, inspect, re-import in a clean profile; marks and unavailable records match |
| Invalid or newer backup | Rejected with an explanation; the current notebook is untouched |
| Storage failure | Optimistic edits never claim Saved; the export path stays reachable |
| Accessibility | Core flows complete by keyboard; ingredient disclosure announces state; controls work at 200% zoom |
| Responsive | 360/390 px and desktop: no horizontal overflow, long locations wrap, Back path visible |
| Regression/offline | Habitats stays between Pokédex and Housemates; existing lists work; a recipe never opened online renders text fallbacks offline without error |

## 12. Release gates and limitations

[Likely] Release requires the required behavior and the acceptance scenarios, not complete unlock coverage. The data gate is honesty: every displayed claim carries a source, every unknown is visibly unknown, and no acquisition line is presented as unlock guidance. The release note and `README.md` state the measured coverage from the audit report.

[Certain] This plan verified repository structure, catalog counts and importer behavior. It did not run the extraction, verify game behavior, or verify a running Crafting UI.

## 13. How `[Likely]` becomes `[Certain]`

[Certain] The promotion rule: **a `[Likely]` becomes `[Certain]` only when it carries a repository citation, a decision ID with a passing test, an evidence record with source URL and retrieval date, or a named verification artifact. Implementing something never promotes it.**

- **Repository claims** are resolvable by reading; target state is zero `[Likely]` labels on repository behavior, so a remaining label always marks a real unknown. Re-run that pass on every revision.
- **Design decisions** are enforced, not verified: give each a stable ID (`D-UNLOCK-02`, `D-ID-02`), name the test after the ID, cite the ID at the enforcement point, and keep one validator shared by load and backup paths. A decision with no test is unenforced, and that gap is then found by grep.
- **Source claims** carry provenance or they are not displayed as recorded. Unlock text without a source URL and retrieval date renders as Not yet documented; conflicts render as conflicts; coverage numbers come from the audit report, never from prose.
- **Running-app claims** need artifacts and deliberate fault injection: block IndexedDB, corrupt the crafting payload, open a never-viewed recipe offline, import a malformed backup.
- Before each phase exits, walk its `[Likely]` statements and record each as promoted, enforced, evidenced, verified, or still open with a reason. An open statement at release is expected; an unlabelled one is not.
