# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is the person who keeps this notebook: one Pokopia player using it as a personal companion during play, not a public audience or a multi-player product.

## Product Purpose

Pokopia Fieldnotes is a local field guide for Pokémon Pokopia. It exists so the player can record what they have found and look up a species without leaving the game for long.

Success is a fast, trustworthy lookup-and-record loop during a play session. Habitat location saving, item unlock lookup, and housemate grouping exist in the product, but they lose when they conflict with that loop.

## Positioning

A personal, device-local Pokopia notebook that treats discovery recording and species lookup as the job. Neighboring public companions and in-game screens cannot truthfully claim to be this player's private record.

## Operating Context

Used beside the game, typically on a phone or laptop browser, to check a fact and mark a find, then return to play. Progress lives in this browser's IndexedDB ("My notebook") with optional JSON export/import to move or back up the record. There is no account, server, or live game API. The production app shell, catalog, and baked artwork work offline after a successful first visit.

Shipped destinations: Pokédex, Habitats, Items, Housemates. Habitat and Housemates requirements stay as read-only reference knowledge, with a `Find in Storage` handoff to the Storage locator from any catalog item. The web app is deployed at `https://pokefields.pages.dev/`; its public privacy/support pages use the dedicated `https://pokefields-privacy.pages.dev/` origin.

## Capabilities and Constraints

Shipped:

- Per-area found marks, search, and filters across main, event, and basin dexes.
- Habitat catalog with read-only requirement reference and lightweight saved-location records (where an already-built habitat exists).
- Items directory covering crafting unlocks, cooking, buildings, and collectibles. Learned and collected marks are player-declared filters, not inventory.
- Housemate grouping from found Pokémon, with construction, furnishing, and environment guidance. Suggestions are application heuristics, not a friendship simulation or proof of an in-game requirement.
- Versioned `public/data/catalog.json` imported at build time from pinned PokopiaAPI records and independently extracted Serebii facts. Unknown details stay unfilled.

Confirmed binding constraint from init:

- Stay an unofficial fan project. Do not imply affiliation with Nintendo, Game Freak, Creatures, or The Pokémon Company.

Open, not confirmed as future-binding in this interview:

- Cross-device cloud sync (`docs/cloud-progress-sync-plan.md`): drafted, not shipped.
- Inventory counts, screenshot import, and zone planning: researched or proposed, not shipped.
- Whether "unknown stays unknown" and "guidance is not proof" remain hard rules for new work: they are current catalog and UI practice, not separately confirmed here.

## Brand Commitments

Name: **Pokopia Fieldnotes** (wordmark: pokopia / FIELDNOTES).

Shipped voice is a field-guide notebook: "My notebook", "friends found", "Every discovery makes this place a little more yours." Prefer direct explanation over cozy marketing copy in Housemates.

Pokémon names and artwork remain the property of their respective owners.

## Evidence on Hand

- `public/data/catalog.json` and source notices in the notebook dialog and `README.md`.
- Baked species, habitat, and item images under `public/images/` (gitignored; produced at bake/build).
- PokopiaAPI BSD-3-Clause notice: `public/data/POKOPIAPI-LICENSE.txt`.
- Research and coverage notes under `docs/` and `docs/research/`.

Do not fabricate testimonials, player counts, or completeness of the in-game catalog. The verified production URL is `https://pokefields.pages.dev/`.

## Product Principles

1. Protect the in-session lookup: recording a find and checking a species must stay fast enough to use while playing.
2. This is one player's notebook. Do not add social, multi-user, or public-profile behavior unless that decision is made later.
3. Remain an unofficial fan project in name, copy, and claims.
4. When features compete for attention, discovery tracking wins.

## Accessibility & Inclusion

No product-specific accessibility standard was established in this interview.
