# AI-generated habitat build canvas — conversation transcript

Date: 12 September 2026. Captured so a follow-on chat agent can resume this thread with full context. This is a faithful summary of the discussion (not a verbatim log), including the research findings, decisions made, and the artifact produced.

## 1. Original idea: inventory-driven build suggestions

**User's ask:** Build a Canvas-style UI where the user describes/enters the quantity of items they own, and an AI agent (Claude or Codex API) generates a habitat build suggestion — telling them what amount of items is required.

**Assistant's take:** Habitat requirements in this repo (`src/habitats/requirements.ts`, `builds.ts`) are fixed game data, not something an LLM should invent — letting a model guess quantities risks hallucinating requirements that contradict the real game. Recommendation: keep requirement math 100% deterministic (already implemented), and use an LLM only at the edges — parsing free-text inventory ("I've got like 5 wood and a couple stones") into structured item counts, then a local matcher ranks habitats by buildable/near-buildable, and the LLM just phrases the result. Two implementation paths discussed: (a) new page inside this app reusing existing catalog/shopping code, or (b) a standalone tool calling the API for the whole flow (more hallucination risk, less consistent with real data).

## 2. Pivot: AI-designed habitat layout instead of inventory matching

**User's ask:** Drop the inventory-passing idea. Instead, the AI should call the existing catalog and generate a full habitat *design*: a grid layout (e.g. 8×6), with a "founding structure" preselected by the user, plus furniture/item placement, item quantities used, and which Pokémon go in the habitat. This needs to render the way the game renders — an actual image of the layout. The AI should be creative, but bounded by rules/a "skill" so the output is structured.

**Assistant's research on the existing data model:**
- Habitats in this catalog (`src/habitats/types.ts`) are text requirement lists (e.g. "Requires 8 × Wildflowers") plus areas/rarity/times/weather — **not** a spatial grid model. No footprint, no furniture placement, no grid concept exists for them.
- `src/planner` (the "Cozy Planner" feature) already has a *different* concept — **build Kits** — with real `width`/`depth`/`height`/`capacity` fields (`src/catalog/types.ts` `Kit`/`PlannableKit`), plus placement logic (`canPlace`, `generatePlan` in `src/planner/engine.ts`) and a furnishing-matcher (`furnishings()`) that assigns items to residents based on favorite categories. This is much closer to what the user is describing than the "habitat" data is.
- Conclusion: split the problem into two separable pieces —
  1. **The design decision** (what to place, where, which Pokémon): a constrained-generation problem. Give the model a strict schema (grid size, item footprint + category, real `HabitatAssociation` data for Pokémon eligibility) and have it fill the schema via structured/tool-use output; validate deterministically against the real catalog (collisions, grid bounds, unknown items, ineligible Pokémon); regenerate on failure. This is the "skill/rules" the user asked for.
  2. **The rendering** (drawing it like the game): recommended *against* asking the AI to produce the image directly (that's where hallucinated-but-pretty output diverges from the real data). Instead: AI outputs JSON, a deterministic renderer (SVG/Canvas) the developer controls draws it from real icon/sprite assets.
- Flagged the real blocker: the catalog has **no furniture/footprint/grid data at all** for individual items — that has to exist before spatial placement of any kind is possible.

## 3. Sourcing 2D/3D spatial models online

**User's ask:** Go online and find a source for 2D or 3D spatial models of items/blocks, suitable for rendering on a grid-based canvas, that an AI could then build a layout over.

**Research findings (via live web search/fetch):**
- No licensed dataset of official in-game 3D meshes exists anywhere in the fan ecosystem.
- [`appleforever11/pokopia-builder`](https://github.com/appleforever11/pokopia-builder) — the most ambitious fan 3D tool — states outright: *"The app does not currently have official in-game mesh files."* Its pipeline: users manually supply `.usdz`/`.scn`/`.dae`/`.obj` files per item, or submit screenshots for someone to hand-model, or the app falls back to generic procedural primitives (cube, wall, floor, crystal, lamp, table, chair) when no real model exists. No license/legal story; explicitly disclaims Nintendo/Pokémon Company affiliation.
- [`JEschete/PokopiaPlanning`](https://github.com/JEschete/PokopiaPlanning) — the most complete structured community dataset (Habitats.csv, Items.csv, Favorites.csv sourced from Serebii) — has **no per-item footprint/dimension data**, only a flat "max 10×10 blocks" constraint per structure.
- Other fan planners surfaced ([Buildopia](https://buildopia.pages.dev/builder), [Pokopia Island Planner](https://pokopiamap.com/island-builder), [Pokopia Block Builder](https://block-builder-nu.vercel.app/)) render 3D/top-down layouts but show no evidence of real extracted meshes — almost certainly generic voxel blocks + icon overlays.
- Why there's no real source: actual in-game meshes would require datamining the Pokopia client binaries — extracting Nintendo/Pokémon Company IP from the app package, a real copyright/ToS risk, not a "find the link" problem. The official [press.pokemon.com Pokopia assets page](https://press.pokemon.com/en/Pokemon-Pokopia) is a journalist press kit (marketing screenshots/logos), not a licensable dataset.
- What this repo already has that *is* usable: 1,765 flat 2D item icons already scraped into `public/images/items/` from Serebii (same reuse posture as `POKOPIAPI-LICENSE.txt` and the sourcing table in `docs/pokopia-companion-plan.md`). Recommendation: build the canvas as a **2D top-down grid** using these existing icons, not 3D meshes. Per-item footprint size still doesn't exist anywhere and would need to be authored by hand.

## 4. Verifying "block size" data on Serebii

**User's ask:** "I have seen what the block size is... can you verify that on Serebii?" (recalling something like an "8×6" figure).

**Verification (via WebFetch of live Serebii pages):**
- Confirmed: every build-kit page on Serebii has an exact **Size** spec (Width / Depth / Height), e.g.:
  - [Small office kit](https://www.serebii.net/pokemonpokopia/build/smallofficekit.shtml): 10 / 10 / 7
  - [Abandoned Power Plant kit](https://www.serebii.net/pokemonpokopia/build/abandonedpowerplantkit.shtml): 31 / 29 / 17 — **matches exactly** what's already sitting in this repo's `public/data/catalog.json` (`kits[]`), confirming the import script already pulled this field in.
- The overview page ([building.shtml](https://www.serebii.net/pokemonpokopia/building.shtml)) states a global rule: exceed an **11×12** width-by-depth structure and it stops counting as a habitat — useful as a validation bound for any grid renderer.
- Important caveat re-confirmed: this is the **outer kit/structure footprint** (the plot a whole building occupies), not per-item furniture footprint inside it. That gap still stands — no source publishes it.
- Cross-checking the catalog directly found the user's remembered "8×6" is real: `cityhousekit` — width 8, depth 6, height 6, capacity 4, kind `residence` — already in `public/data/catalog.json`.

## 5. Building the MVP

**User's ask:** Work on an MVP — render something using whatever data already exists, no more research first.

**Scoping questions asked and answered:**
- Where should the MVP live? → **Standalone prototype first** (not wired into the app's codebase yet).
- How much spatial detail should the first render attempt? → **Attempt in-grid item placement**, even knowing per-item footprint/position data doesn't exist anywhere (i.e., that layer would have to be illustrative/invented, clearly labeled as such).

**Data assembled for the MVP (all real, pulled directly from this repo):**
- Kit: `cityhousekit` — `{ width: 8, depth: 6, height: 6, capacity: 4, kind: "residence", buildTime: "Next day" }`, materials `Pokémetal ×25, Glass ×25, Concrete ×25, Iron ingot ×25`, source `https://www.serebii.net/pokemonpokopia/build/cityhousekit.shtml`.
- Icons used from `public/images/items/`: `cityhousekit.png` (kit watermark), `pokemetal.png`, `glass.png`, `concrete.png`, `ironingot.png` (materials — confirmed), `ironbed.png`, `irontable.png`, `ironchair.png`, `chainlamp.png` (furnishing — illustrative, chosen only for material-theme consistency with the kit).
- Pokémon icons used from `public/images/pokemon/`: Pikachu (`83.png`), Charmander (`4.png`), Squirtle (`7.png`), Meowth (`88.png`) — picked arbitrarily as a 4/4-capacity example roster; **no data in the catalog maps a kit to Pokémon by environment**, so this roster is explicitly illustrative, not derived.

**What was built:** A published Artifact, **["City House Blueprint"](https://claude.ai/code/artifact/6c104db8-0f48-45f6-9e68-d763243963fd)** — a graph-paper/blueprint-styled grid canvas rendering the 8×6 footprint to scale, with:
- A **rust/solid** visual language for confirmed data (footprint, capacity, build materials + quantities, Serebii source link).
- A **plum/dashed** visual language for illustrative/invented data (furnishing placement, resident roster), including a toggle switch to strip that layer back to just what's verifiable.
- A footer statement spelling out exactly what's real vs. invented, so the artifact is honest about its own evidentiary status (same discipline this repo's other planning docs use, e.g. the `[Certain]`/`[Likely]`/`[Guessing]` notation in `docs/pokopia-companion-plan.md`).

This proved the render is viable today with zero AI involvement and zero new data — just existing catalog fields (`Kit.width/depth/height/capacity/materials`) plus existing scraped icons.

## 6. Open next step (where this thread left off)

The natural next slice: decide where the *invented* layer (furnishing choice/placement, resident roster) stops being a static hand-picked sketch and starts being something an agent actually decides — given the same schema (grid bounds, confirmed materials list, capacity, real `HabitatAssociation` eligibility data), have Claude/Codex choose furnishings and placement under explicit rules (stay inside the footprint, respect capacity, only use items with a known icon, only assign Pokémon actually eligible for whatever habitat/kit is in play), with a deterministic validator rejecting/repairing anything that breaks those rules before it's rendered.

Unresolved/needs deciding with the user before building that:
- Whether this later moves from the standalone artifact into the real app (`src/`) — deferred from this thread, not decided yet.
- Whether per-item footprint sizes get authored by hand (from observing the game) as real data, or whether the AI is allowed to invent plausible footprints too (higher creativity, lower ground-truth).
- Which structured-output mechanism (tool-use schema, JSON mode, etc.) and which model (Claude vs Codex) to use for the generation step, and what the deterministic validator's exact rule set should be.

## Key facts for quick reference

- This project: **Pokopia Fieldnotes** — a React + TypeScript + Vite companion app for the game **Pokémon Pokopia**, tracking Pokédex, habitats, crafting, items, and a "Cozy Planner" for housing.
- Catalog source of truth: `public/data/catalog.json` (`{ version, pokemon, kits, items, areas, sources }`), imported via `scripts/import-data.mjs`, sourced primarily from Serebii + the PokopiaAPI repo (BSD-3-Clause) — see `docs/pokopia-companion-plan.md` for full source-by-source licensing notes.
- Existing spatial/placement code to reuse: `src/planner/engine.ts` (`canPlace`, `generatePlan`, `furnishings`, `swapResidents`), `src/catalog/types.ts` (`Kit`, `PlannableKit`, `isPlannable`).
- Existing habitat (non-spatial) code: `src/habitats/` (`types.ts`, `builds.ts`, `requirements.ts`, `catalog.ts`).
- Icon assets already on disk: `public/images/items/` (1,765 PNGs), `public/images/pokemon/` (numbered by national dex number).
