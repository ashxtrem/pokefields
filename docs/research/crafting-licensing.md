# Crafting source licensing decision

Date: 2026-09-10  
Decision ID: **D-LIC-01**

## Question

Can this project extract recipe yield, unlock, or ingredient values from Bulbapedia (CC BY-NC-SA) — or from other third-party trackers — and bundle them into `public/data/catalog.json`?

## Outcome

**No.** Bulbapedia's share-alike and non-commercial terms are materially different from the Serebii factual-reference arrangement and the PokopiaAPI BSD-3-Clause notice already documented in `README.md` and `public/data/POKOPIAPI-LICENSE.txt`. Bundling derived Bulbapedia values into the shipped catalog is not treated as compatible with this project's distribution.

Pokopia World and Pokopia Tracker were not bulk-imported. Their public counts were not used as recipe truth.

## What version one may use

1. Existing catalog fields already imported from the pinned PokopiaAPI snapshot and Serebii item/cooking pages.
2. Explicit identity aliases reviewed in `src/crafting/data/aliases.json`.
3. Conflict flags that record that independent sources disagree, without copying the other source's numbers into recipe arithmetic.

Unlock, yield, and per-craft ingredient basis remain **Not yet documented** unless they are already present in the Serebii/PokopiaAPI-derived catalog and reviewed as compatible. Inferred notes cannot become asserted requirements.

## Attribution form

No additional Bulbapedia attribution is required because no Bulbapedia-derived values are bundled. Existing PokopiaAPI and Serebii source lines in the catalog and notebook dialog remain unchanged.
