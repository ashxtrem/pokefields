# Pokédex type background colors

Date: 9 September 2026
Status: proposed; UI implementation has not started.

## Purpose and scope

[Likely] Muted type backgrounds will help players scan Pokémon while preserving the existing cream-and-forest theme. This is a design hypothesis to verify visually.

- Tint the entire Pokémon card in the Pokédex.
- Apply the identical tint to the full-view header containing the Pokémon name, image, types, and specialties.
- Keep the full-view tabs and information sections on their existing neutral surfaces.
- Limit this change to these two surfaces; habitat cards, planner cards, navigation, and page backgrounds are outside scope.

## Proposed palette

[Likely] Use these explicit, opaque sRGB hex colors as the implementation baseline. They are theme-adjusted type cues, not official Pokémon color specifications. Keep tint strength visible without using saturated fills.

| Type | Background hex | Color direction |
| --- | --- | --- |
| Normal | `#EEECE3` | Warm linen |
| Fire | `#F5E2D3` | Soft peach |
| Water | `#DFECF2` | Dusty blue |
| Electric | `#F5EDCA` | Butter yellow |
| Grass | `#E3ECD8` | Sage |
| Ice | `#E0F0ED` | Cool mint |
| Fighting | `#F0DEDA` | Muted terracotta |
| Poison | `#ECE1EF` | Mauve |
| Ground | `#EDE3D0` | Sand |
| Flying | `#E7E9F3` | Pale periwinkle |
| Psychic | `#F3DFE9` | Dusty rose |
| Bug | `#E9EDCF` | Yellow olive |
| Rock | `#E7E2D5` | Warm stone |
| Ghost | `#E5E0EF` | Smoky lavender |
| Dragon | `#E0E3F1` | Muted indigo |
| Dark | `#E3DFDC` | Warm gray |
| Steel | `#E1E7E7` | Cool gray |
| Fairy | `#F4E3EE` | Soft pink |
| Missing or unsupported type | `#FFFEFA` | Existing neutral cream |

## Foreground and supporting colors

[Likely] Use the following shared roles on the tinted surfaces. Avoid assigning a separate text hue to every type.

| Role | Hex | Rule |
| --- | --- | --- |
| Name and primary text | `#263D31` | Deep forest; use on every type fill |
| Metadata and secondary text | `#4F5D50` | Dark muted green; replaces faint labels within scope |
| Type badge text | `#263D31` | Keep labels legible at their current small size |
| Type badge fill | Corresponding type background above | Each badge represents its own type, including secondary types |
| Decorative card/header border | `#C8CEC2` | Subtle shared outline; not a status indicator |
| Focus outline and active control fill | `#28533F` | Preserve recognizable interaction color |
| Text/icon on active control | `#FFFEFA` | Light foreground on deep forest |
| Pokémon artwork circle | `#FFFEFA` | Neutral backing separates artwork from type tint |

[Certain] Calculated WCAG relative-luminance contrast across all 18 proposed type fills and the fallback is at least **8.84:1** for primary text, **5.26:1** for secondary text, and **6.61:1** for the focus color. The darkest fill, Dark, produces each minimum. These calculations cover these exact solid-color pairs; they do not yet verify rendered controls, overlays, or existing component styles.

## Type and state rules

- Use the first catalog type as the primary background type, consistently in both views.
- Preserve the catalog type order. Do not choose a background from the artwork color or reorder types for aesthetics.
- For dual types, use one flat primary-type background and retain both named badges. Do not blend colors or split the card background.
- Normalize type names for lookup; use the neutral fallback when no supported primary type is available.
- Keep type labels visible: similar pastel hues cannot uniquely identify all 18 types for every viewer.
- Keep found/unfound status independent of the type fill. Preserve the existing explicit status control and checkmark; a green background must never imply discovery.
- Keep the type fill stable on hover, focus, and found-state changes. Use outline, existing movement, and control state to communicate interaction.
- Preserve artwork, layout, card links, discovery behavior, and detail content.

## Implementation sequence

[Certain] The current `src/dex/DexPage.tsx` already applies primary-type classes to both cards and the detail header. `src/styles.css` currently gives only Fire, Water, and Bug distinct artwork-circle colors, while the detail header has one shared green fill.

1. Define one shared set of type surface variables for all 18 types and the fallback in `src/styles.css`, scoped to the intended surfaces.
2. Apply that surface variable to `.pokemon-card` and `.detail-hero`; ensure an unset or unsupported class uses the fallback.
3. Replace the three existing type-specific artwork-circle overrides with the neutral backing rule.
4. Apply the foreground roles to names, metadata, specialties, and type badges within these surfaces. Check nested components for inherited or overridden foreground colors.
5. Preserve found-state behavior and ensure its control remains distinct on Grass and Bug cards.
6. Add a small shared type resolver only if required for normalization/fallback; do not duplicate a palette in both CSS and component code.

## Acceptance and verification

- [ ] All 18 types have the exact planned background hex codes.
- [ ] A Pokémon has the same background in the grid and full-view name/image header.
- [ ] Dual types retain both readable badges and use the primary-type fill.
- [ ] Missing/unsupported types use the neutral fallback.
- [ ] Normal-sized text meets 4.5:1 contrast; focus and required control indicators meet 3:1 against adjacent colors.
- [ ] Check computed styles for text and controls, including hover, focus, found, and unfound states.
- [ ] Inspect the actual grid and detail header on desktop and mobile, with representative warm, cool, and gray fills and light/dark artwork.
- [ ] Compare Grass/Bug, Water/Ice, Poison/Ghost, Psychic/Fairy, and Normal/Ground/Rock; retain named badges even if colors remain similar.
- [ ] Check keyboard focus, card navigation, and discovery toggling; confirm header tint stops before the tabs/content.
- [ ] Run the existing project checks appropriate to the eventual change. Add tests only if introducing meaningful type-resolution logic.

[Likely] Complete one combined desktop/mobile visual review, fix any defects in one batch, and perform one confirmation pass. If a palette value changes during verification, update this table and recalculate its contrast before marking the work complete.
