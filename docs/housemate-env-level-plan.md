# Housemate: environment-level-aware item suggestions

Date: 12 September 2026
Status: implemented.

## Purpose

[Certain] The Cozy Planner's furnishing suggestions (`furnishings()` in `src/planner/engine.ts`, and `environmentSupplies()` in `src/planner/recommend.ts`) pick items purely by matching favorite categories or environment. Many catalog items are gated behind an in-game "environment level" for their town — not only Bubbly Basin, as first scoped, but all seven towns. This let the planner suggest an item the player has no way to buy yet. The player now records their current environment level per town, and locked suggestions are flagged rather than hidden.

## What shipped (differs from the original scope in two ways)

[Certain] The original draft of this document scoped the gate to Bubbly Basin only, parsed from a single `recipeLocation` field format (`Shop – Bubbly Basin (Env. level N)`), with one flat default level (3) for every town. Investigating the full catalog before implementation found that scope too narrow to be useful:

1. **All seven towns carry level-gated items, in three different text formats spread across three fields.** `item.recipeLocation`, `item.locations[]`, and `item.recipeMeta.unlock.methods[].text` each independently carry lines like `Shop - Palette Town Lv. 9`, `Shop (as bundle) - Withered Wastelands Lv. 5`, `Shop as bundle (Sparkling Skylands Lv. 6)`, `Shop - Unlocked at Cloud Island Lv. 4`, and even a `Palette Town lLv. 4` typo, alongside the original `Shop – Bubbly Basin (Env. level 10)` wording. Counting across all three fields and all towns: 376 items carry at least one level gate (Withered Wastelands 60, Cloud Island 158, Bleak Beach 63, Palette Town 56, Rocky Ridges 45, Sparkling Skylands 51, Bubbly Basin 47), of which 185 have `categories` (i.e. are furnishing suggestions). Only ~47 of those would have been caught by the original Bubbly-Basin-only parser.
2. **Some items are sold in more than one town, or also have a non-shop route.** 96 items carry level gates in more than one town (e.g. Bonfire: Withered Wastelands Lv. 5 *or* Cloud Island Lv. 5); 149 gated items also have a Natural/Original/Treasure spawn location or a "Craft from recipe" route. An item is only actually unobtainable when *every* recorded route is unmet.

## Implementation

[Certain]

- **Parsing** (`src/dex/glossary.ts`): `parseEnvLevel(text)` matches any of the town names against a single regex tolerant of the `Lv.`/`Level`/`Env. level` wording variants (including the `lLv.` typo). `itemEnvRequirements(item)` runs it over `recipeLocation`, `locations`, and `recipeMeta.unlock.methods[].text` together and dedupes to the lowest level per town. `ENV_LEVEL_TOWNS` is the fixed seven-town list (matching `AREAS`), independent of whether the catalog currently has a gated item for a given town, so the level popup always offers all seven.
- **Locking** (`itemEnvLock(item, envLevels)`): locked only when every recorded route's town level is unmet *and* no ungated route (natural spawn, "Craft from recipe", etc.) exists among the item's texts; reports the lowest unmet requirement for the badge.
- **Defaults** (`recordedEnvLevel`): Withered Wastelands defaults to level 3 (the first area rebuilt); every other town defaults to 1, until the player records otherwise.
- **Persistence** (`src/persistence/store.ts`): `envLevels?: Record<string, number>` on `SaveState`, validated (0–99 per town), defaulting to `{}`, flowing through the existing `useProgress()`/IndexedDB pattern — no new storage mechanism.
- **UI**: a shared `EnvLevelsModal` (`src/ui/components.tsx`) lists all seven towns with a 1–10 level `<select>` each, saving on every change. It opens from:
  - the Housemates setup form (a "Town levels" field, showing the current planning area's level on its button),
  - the collapsed setup's quick-view summary (a small chip, e.g. "Withered Wastelands Lv. 3"),
  - and "My notebook" in the top bar (a "Town environment levels" button), so a level set anywhere is visible and editable everywhere.
- **Badges**: a locked furnishing/environment suggestion shows an `EnvLockNote` badge ("Requires Env. level N") in the Housemates home cards, the home detail furnishings/environment lists, and the house shopping checklist rows; the same badge also appears in the item "Where to find it" explain popup and the Items directory's item detail page, wherever an item is currently locked for the player.

## Deferred scope

[Likely] Automatic detection of the player's real in-game level (self-reported only, as originally decided), and any change to the raw unlock text shown in the explain popup's "Where to find it" list (the badge is additive, not a rewrite of that text).

## Relationship to existing documents

[Certain] This document extends `docs/housemate-planner-plan.md` and `docs/housemate-planner-improvements-plan.md`. It follows the persistence pattern those documents already use (`SaveState` fields with validators and defaults) and keeps this data in scope for `docs/cloud-progress-sync-plan.md` rather than opting it out as a device preference.
