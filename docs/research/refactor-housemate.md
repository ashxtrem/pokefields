You are an expert React 19, TypeScript, and Tailwind CSS v4 frontend engineer.

Refactor the House / Island Planner card components and page layout in the pokopia-companion repository to eliminate vertical clutter, fix ragged card heights, streamline actions, and optimize responsiveness for both desktop and mobile viewports.

1. Project Context & Dependencies

Based on our package.json:

React 19 (react: ^19.1.0, react-dom: ^19.1.0)

TypeScript 5.8+ (typescript: ^5.8.3)

Tailwind CSS v4 (@tailwindcss/vite: ^4.1.0, tailwindcss: ^4.1.0)

Lucide Icons (lucide-react: ^0.468.0)

State / Storage (dexie: ^4.0.11 for offline-first storage)

2. Core Problems in Current Implementation

Vertical Footprint Explosion (Stacked Buttons): Every home card renders two full-width stacked buttons (Change housemates and Change home). Across 6–10 homes, this wastes over 1,000 vertical pixels.

Redundant Pokémon Text: Sprites are displayed in a row, and immediately below them is a comma-separated text string repeating all Pokémon names (e.g., Slowbro, Slowpoke, Goomy, Squirtle), which doubles header height without adding value.

Erratic Trait Wrapping: Item traits use dot-separated inline strings (e.g., Cleanliness · Cute stuff · Lots of water · Strange stuff) that wrap unpredictably onto 3–4 lines.

Ragged Baseline Grids: Some houses require 2 furnishings while others require 6. Without equalized height structures or flex alignment, adjacent cards have mismatched heights.

No Island Overview or Area Filtering: Players cannot quickly filter by area (e.g., Area 1, Cave, Cliff, Floor) or toggle into a high-level compact view.

3. Component Architecture & Required Changes

Refactor the components responsible for the island planner (e.g., HouseCard.tsx, HouseList.tsx, or IslandPlannerPage.tsx) following these design specifications:

A. Card Header & Sprite Row

Remove the redundant plain-text Pokémon names line under the sprites.

Display sprites in a connected avatar tray with subtle borders (w-8 h-8 or w-9 h-9, rounded corners).

Add hover/focus tooltips displaying each Pokémon's name and primary typing (e.g., using accessible title attributes or Radix/floating tooltips).

Display the Kit Name, Weather condition badge (e.g., Humid, Bright, Breezy with matching icon: <CloudRain/>, <Sun/>, <Wind/>), and completion status in a clean single-row header.

B. Furnishings Checklist & Tags

Quantity Badge Overlay: Move 1 × from the title text into a tiny absolute pill in the corner of the thumbnail icon (e.g., top-[-4px] left-[-4px] bg-slate-800 text-white text-[9px] font-bold px-1 rounded).

Tag Chips: Convert dot-separated trait strings into mini badges (text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium).

Checklist Interaction: Ensure players can toggle item placed/unplaced status (store this in local state / Dexie DB). Checked items should display a subdued appearance (line-through text-slate-400) and a filled check circle (<Check/>).

C. Compact Bottom Action Dock (Eliminate Stacked Buttons)

Replace the two tall stacked buttons with a single 1-row flex dock at the bottom of each card:

Secondary CTA: Compact button with icon for Change Home (or <Building/> icon button).

Primary CTA: Solid button for Housemates (bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3 py-1.5 rounded-xl).

Maintain a minimum 44px touch target height for mobile ergonomics while saving ~60% vertical space compared to stacked buttons.

D. Density Modes & Area Filtering (List Controls)

Add a toolbar above the cards grid with:

Area Filter Pills: All, Area 1, Cave, Cliff, Floor, etc., with count badges (e.g., Area 1 (2)).

View Density Toggle:

Detailed View (Default): Full interactive item checklist with tag chips.

Compact View: Collapses the item checklist into a single-line summary with a progress percentage bar (e.g., 4 of 6 placed [====---] 66%), ideal for reviewing the entire island at a glance.

KPI Counters: Display summary statistics at the top: Total Homes, Total Pokémon Housed, Total Items Required, and Overall Completion %.

4. TypeScript Interface Specifications

Ensure strict types for homes and furnishings:

export interface PokemonHousemate {
  id: number;
  name: string;
  spriteUrl: string;
  types: string[];
}

export interface FurnishingRequirement {
  id: string;
  name: string;
  quantity: number;
  iconName?: string;
  tags: string[];
  isPlaced: boolean;
}

export interface IslandHome {
  id: string;
  area: string;          // e.g., "Area 1", "Cave", "Cliff"
  kitName: string;       // e.g., "Yellow hut kit"
  weather: string;       // e.g., "Humid", "Bright"
  weatherColor?: string; // e.g., "sky", "amber", "teal"
  sharedPreferences: string[];
  housemates: PokemonHousemate[];
  furnishings: FurnishingRequirement[];
}


5. Responsive Layout Guidelines (Tailwind CSS v4)

Grid Container:

Mobile: Single column grid-cols-1 gap-4.

Tablet/Desktop: 2 equal-height columns md:grid-cols-2 lg:grid-cols-2 gap-5 items-stretch.

Ensure card wrappers use flex flex-col justify-between h-full so card bottoms align evenly across grid rows regardless of content length.

Color Palette & Theme Tokens:

Use Pokopia theme tokens: soft cream backgrounds (bg-[#f7f9f6]), forest emerald accents (bg-emerald-800, text-emerald-900, border-emerald-200/60), and slate text (text-slate-800).

Dark mode compatibility or contrast compliance (minimum 4.5:1 contrast for item labels).

Icons: Use lucide-react icons (e.g., Check, Users, Home, CloudRain, Sun, Wind, Sparkles).

6. Acceptance Criteria

[ ] Vertical card height is reduced by at least 35% in detailed mode.

[ ] No duplicated plain-text lists of Pokémon names when sprites are already visible.

[ ] Trait metadata does not create awkward multi-line wrapped text blocks.

[ ] Bottom action dock fits cleanly on a single row without button text truncation.

[ ] Users can toggle between Detailed and Compact density modes.

[ ] Filter pills filter homes by their respective Area without page reloads.

[ ] Fully responsive down to 360px viewport width (no horizontal scrolling).

[ ] Passes TypeScript checks (npm run build) with zero lint/type errors.