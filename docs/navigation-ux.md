# Navigation continuity

Browsing state is remembered for the current app visit. Reloading resets it; notebook progress remains in its existing persistent store.

- Each page restores its last vertical scroll position, including browser Back and explicit detail-page return links.
- Pokédex retains the selected dex, search, filters, sort, and expanded filters.
- Each Pokémon remembers its selected detail tab independently.
- Habitats retains filters and expanded controls. Explicit filter URLs and browser history continue to apply.
- Housemates retains its area, search, exclusions, selected home, detail tab, and draft when navigating away.
- Items remembers search, Crafting-tab filters (category, Hide learned, sort, material `?uses=`), and — for this visit — each inner tab’s list scroll and opened item or recipe. Switching All Items / Crafting Recipes / Food / Buildings / Collectibles restores that tab. The top bar Items link restores the last Items URL, including the inner tab. Recipe detail uses `#/items/recipe/:id` so scroll restoration can tell it apart from the directory. Shipped `#/crafting` and `#/crafting/recipe/:id` hashes redirect there. Refresh keeps notebook progress and honors the URL; transient filters and tab memory follow the visit contract.
- Collectible “I have this” marks are a manual notebook record, undoable, and round-tripped in backups. An id that leaves the catalog is kept and listed as an unavailable collected record.
- Page content fades in over 160 ms; Pokémon detail tabs use 140 ms. Repeated card entrance animations are removed. Reduced-motion preferences disable these effects.

Verified in the local browser: sidebar scroll restoration (2160 px before and after), Venonat detail return and browser Back (card visible again), remembered Preferences tab, Event Pokédex selection across section changes, mobile sidebar navigation and habitat search retention, and no horizontal overflow at 390 px. Existing 72 tests passed. These checks do not establish a frame-time performance benchmark.

Crafting verification for 2026-09-10 is in `docs/crafting-verification.md`.
