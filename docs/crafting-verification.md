# Crafting verification (2026-09-10)

Local browser: Playwright against `http://127.0.0.1:5174`, Node 22. Isolated notebook in that profile (1 learned mark, 1 list entry for Plain stool). Image bake was skipped; text fallbacks rendered without error.

| Viewport | Flow | Observed |
|---|---|---|
| ~1280×800 | `#/crafting` | Primary nav order Pokédex → Habitats → Housemates → Crafting (883). 0 then 1 / 883 learned. Search “plain stool” → 1 result. |
| 1280×800 | Recipe detail | Ingredients Lumber ×1, Twine ×1; specialty and unlock **Not yet documented**; add uses documented-list quantity. |
| 1280×800 | Mark learned | Count 1 / 883; Undo “Marked learned”; announcement. |
| 1280×800 | Add / list / finish / undo | Entry on Crafting List; finish remaining empties the list; Undo restores the partial entry; materials notes unchanged. |
| 1280×800 | Reverse lookup `?uses=lumber` | 171 recipes (matches audit occurrence). Unresolved labels excluded in copy. |
| 1280×800 | Habitat Computer → View recipe | `#/habitats/researcher'sdesk` explanation links to `#/crafting/recipe/recipe:computer:default`. No allocation change. |
| 1280×800 | Wooden steps | Conflict notice shown; craftable-from-notes suppressed as conflicting. |
| 1280×800 | Quantity `1.5` | Inline alert; `aria-invalid`; saved state not mutated. |
| 1280×800 | My notebook | 1 recipe marked learned, 1 crafting list entry, 0 unavailable records. |
| 390×844 | Recipes / detail | List then dedicated detail with Back to recipes; no horizontal overflow of the recipe column. |
| 360×800 | Recipes | `scrollWidth === clientWidth` (360). Nav labels remain visible. |

Not injected in this pass: IndexedDB blocked “Not saved”, production offline image fallback, malformed/newer backup import. Those remain for a later fault-injection pass.

`npm test`: 128 tests passed. `tsc -b`: clean.
