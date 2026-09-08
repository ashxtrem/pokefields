# Pokopia Fieldnotes

A responsive, local-first Pokémon Pokopia companion: searchable Pokédex and a Cozy Planner. React + TypeScript + Tailwind, built with Node/Vite for Cloudflare Pages.

## Run

Use Node 22 (see `.node-version`).

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

`dist/` is the deployable site. No server, API key, database service or paid backend is required. Progress lives in IndexedDB in the current browser. Export/import JSON backups through **My notebook** to transfer devices. Clearing browser data removes local saves.

## Features

- Main, event and basin dexes; name/number search; discovery, found-area, spawn-area, specialty, type, time and weather filters; number/name sorting.
- Separate found marks for every area, including Pokémon found in multiple places.
- Detail tabs for facts, attracting habitats/requirements, preferences and progress.
- Planner uses the selected area's found roster, optional exclusions, a rectangular block plot, supported building kits and quantity limits.
- Deterministic groups based on matching environments and shared favorite categories. These are furnishing recommendations, not a friendship simulation or proof of an optimal layout.
- Homes respect footprint, capacity and kit limits. Drag to move, edit coordinates, move/swap residents, inspect construction/comfort requirements and see unplaced Pokémon.
- One saved layout per area; discovery/catalog changes flag the old plan without overwriting edits.
- Production app shell and catalog work offline after a successful first visit. External species artwork needs a network connection or the browser's image cache; unavailable images have a text fallback.

## Modules

| Directory | Responsibility |
|---|---|
| `src/catalog` | Typed normalized reference data and provider |
| `src/dex` | Filtering, cards and detail views |
| `src/progress` | Shared discovery/plan state and serialized persistence |
| `src/planner/engine.ts` | Pure grouping, placement, furnishings and swap rules |
| `src/planner/worker.ts` | Background plan computation |
| `src/planner/HomeDetail.tsx` | Construction, care and roommate editing |
| `src/persistence` | IndexedDB and backup validation |
| `src/ui` | Shared dialogs, portraits and discovery controls |
| `scripts` | Source import and production offline-cache generation |
| `tests` | Domain, persistence and imported-data regression checks |

## Reference data

`public/data/catalog.json` is a versioned build-time snapshot, not a live API dependency. `npm run data:import` refreshes the normalized snapshot from pinned PokopiaAPI records and Serebii factual tables. HTML requests are limited to three at a time and cached under `.cache/sources`; remove that cache explicitly to refresh the same URLs. Review changes and bump the catalog version before shipping a new data snapshot.

- [PokopiaAPI](https://github.com/QuesoCaliente/pokopiapi), pinned at `893936af1adb51f6d2aab18aa8fa359fc401dd0a`: stable IDs, dex membership and base metadata. BSD-3-Clause notice is in `public/data/POKOPIAPI-LICENSE.txt`.
- [Serebii Pokopia](https://www.serebii.net/pokemonpokopia/): independently extracted factual preference categories, item associations, spawn conditions, habitat requirements and building dimensions/capacities/materials. Individual source links are retained in the catalog and UI. No guide prose or site artwork is bundled.
- [PokeAPI sprites](https://github.com/PokeAPI/sprites): externally served reference species artwork. Form-specific in-game appearances may differ; the portrait tooltip says this. The source API's image CDN was blocked in this environment, so it is not the main portrait provider.

Pokémon names and artwork remain the property of their respective owners. This is an unofficial fan project, unaffiliated with Nintendo, Game Freak, Creatures or The Pokémon Company. The API code license does not grant ownership of Pokémon artwork.

Known boundaries: den kits are excluded because their size eligibility is not modeled. The grid checks footprints, not doors, paths, terrain, interior layout, furnishing reach, unlocks or comfort levels. Construction helpers are distinct from resident capacity. Food guidance for Frillish/Jellicent distinguishes male/female flavors within the species entry. Special encounters without recorded attracting habitats link to their reference rather than inventing a recipe.

## Cloudflare Pages

For a connected repository, configure build command `npm run build`, output directory `dist`, and Node version `22`. For direct upload:

```sh
npx wrangler login
npm run deploy
```

The deploy script targets the Pages project `pokopia-companion`. Create that project in the desired Cloudflare account if it does not exist, or change the script to an existing project name. `wrangler.jsonc` contains only non-secret build configuration. Do not commit credentials.

Deployment has **not** been completed: the host's previous Wrangler login expired and could not refresh. The production build can be reviewed locally while that login is renewed.

See `docs/pokopia-companion-plan.md` for scope and research decisions, and `docs/verification.md` for completed checks and remaining limitations.
