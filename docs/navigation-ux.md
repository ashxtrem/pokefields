# Navigation continuity

Browsing state is remembered for the current app visit. Reloading resets it; notebook progress remains in its existing persistent store.

- Each page restores its last vertical scroll position, including browser Back and explicit detail-page return links.
- Pokédex retains the selected dex, search, filters, sort, and expanded filters.
- Each Pokémon remembers its selected detail tab independently.
- Habitats retains filters and expanded controls. Explicit filter URLs and browser history continue to apply.
- Housemates retains its area, search, exclusions, selected home, detail tab, and draft when navigating away.
- Crafting remembers search, category, Hide learned, sort, list scroll, and the selected recipe for the visit. Recipe detail uses `#/crafting/recipe/:id` so scroll restoration can tell it apart from the directory. Refresh keeps notebook progress and honors the URL; transient filters follow the visit contract.
- Page content fades in over 160 ms; Pokémon detail tabs use 140 ms. Repeated card entrance animations are removed. Reduced-motion preferences disable these effects.

Verified in the local browser: sidebar scroll restoration (2160 px before and after), Venonat detail return and browser Back (card visible again), remembered Preferences tab, Event Pokédex selection across section changes, mobile sidebar navigation and habitat search retention, and no horizontal overflow at 390 px. Existing 72 tests passed. These checks do not establish a frame-time performance benchmark.

Crafting verification for 2026-09-10 is in `docs/crafting-verification.md`.
