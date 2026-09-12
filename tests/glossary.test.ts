import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import type { Catalog } from "../src/catalog/types";
import {
  allEnvironmentExampleIds,
  contentLabel,
  ENVIRONMENT_VALUES,
  ENV_LEVEL_TOWNS,
  environmentExampleIds,
  explainTerm,
  foodEntries,
  habitatImageUrl,
  itemImageUrl,
  parseRequirement,
  parseEnvLevel,
  itemEnvRequirements,
  catalogEnvLevelAreas,
  isEnvLevelLocked,
  itemEnvLock,
  recordedEnvLevel,
  pokemonArtUrl,
  resolveItem,
  specialtyImageUrl,
} from "../src/dex/glossary";

const catalog = JSON.parse(
  readFileSync("public/data/catalog.json", "utf8"),
) as Catalog;

describe("detail term explanations", () => {
  it("explains ideal environments with a way to achieve them", () => {
    const info = explainTerm(
      { kind: "environment", value: "Bright" },
      catalog.items,
    );
    expect(info.meaning).toMatch(/well-lit/i);
    expect(info.achieve).toMatch(/lamp/i);
    expect(info.items.length).toBeGreaterThan(0);
    expect(info.items[0].image).toMatch(/\/images\/items\/.+\.png$/);
  });

  it("explains specialties as jobs rather than types", () => {
    const info = explainTerm(
      { kind: "specialty", value: "Burn" },
      catalog.items,
    );
    expect(info.meaning).toMatch(/flammable|smelting|clay/i);
    expect(info.achieve).toBeTruthy();
    expect(info.heroImage).toBe(specialtyImageUrl("Burn"));
    expect(specialtyImageUrl("Gather Honey")).toBe(
      "/images/specialties/gatherhoney.png",
    );
    expect(specialtyImageUrl("???")).toBeNull();
  });

  it("attaches example item pictures to favorite categories", () => {
    const info = explainTerm(
      { kind: "favorite", value: "Lots of nature" },
      catalog.items,
    );
    expect(info.items.length).toBeGreaterThan(0);
    expect(
      info.items.every((item) => item.image.startsWith("/images/items/")),
    ).toBe(true);
  });

  it("parses habitat requirements and resolves item pictures", () => {
    expect(parseRequirement("4 × Tall Grass")).toEqual({
      quantity: "4",
      name: "Tall Grass",
      kind: "item",
    });
    expect(parseRequirement("1 × High-up Location")).toMatchObject({
      name: "High-up Location",
      kind: "condition",
    });
    expect(parseRequirement("1 × Bed (any)")).toMatchObject({
      kind: "condition",
    });
    const item = resolveItem("Castform weather charm (sun)", catalog.items);
    expect(item.id).toBe("castformweathercharm");
    expect(item.image).toBe(itemImageUrl("castformweathercharm"));
    expect(pokemonArtUrl(1)).toBe("/images/pokemon/1.png");
    expect(pokemonArtUrl(1, true)).toBe("/images/pokemon/sprites/1.png");
    expect(
      habitatImageUrl(
        "https://www.serebii.net/pokemonpokopia/habitatdex/1.png",
      ),
    ).toBe("/images/habitats/1.png");
  });

  it("shows cooking ingredients instead of a generic cook line", () => {
    const salad = explainTerm(
      { kind: "item", value: "Seaweed salad" },
      catalog.items,
    );
    expect(salad.obtain).toEqual(["Cook with: 1 × Leaf, 1 × Seaweed"]);
    expect(salad.items.map((item) => item.name)).toEqual(["Leaf", "Seaweed"]);
    const shredded = explainTerm(
      { kind: "item", value: "Shredded salad" },
      catalog.items,
    );
    expect(shredded.obtain).toEqual([
      "Cook with: 1 × Leaf",
      "Needs a Pokémon with the Chop specialty",
    ]);
  });

  it("lists where to find an item instead of how to use it", () => {
    const flower = explainTerm(
      { kind: "item", value: "Flower cushion" },
      catalog.items,
    );
    expect(flower.obtain).toEqual([
      "Pokémon Center Exchange",
      "Event: More Spores for Hoppip",
    ]);
    expect(flower.achieve).toBeUndefined();
    // Categories are a set, and the importer now sorts them so that a
    // re-import cannot reshuffle this list.
    expect(flower.categories).toEqual([
      "Cute stuff",
      "Group activities",
      "Pretty flowers",
      "Soft stuff",
    ]);
    const fluff = explainTerm({ kind: "item", value: "Fluff" }, catalog.items);
    expect(fluff.obtain).toEqual([
      "Shop - Unlocked at Rocky Ridges Lv. 3",
      "Shop - Unlocked at Cloud Island Lv. 4",
    ]);
  });

  it("reads a quantity as a footprint for habitats and a build cost for homes", () => {
    const habitat = explainTerm(
      { kind: "item", value: "Stone", quantity: "25" },
      catalog.items,
    );
    expect(habitat.title).toBe("25 × Stone");
    expect(habitat.meaning).toMatch(/habitat footprint/i);
    const home = explainTerm(
      { kind: "item", value: "Stone", quantity: "25", context: "home" },
      catalog.items,
    );
    expect(home.title).toBe("25 × Stone");
    expect(home.meaning).toBe("Home construction needs 25 of this.");
    expect(home.meaning).not.toMatch(/habitat/i);
    const plain = explainTerm({ kind: "item", value: "Stone" }, catalog.items);
    expect(plain.title).toBe("Stone");
    expect(plain.meaning).not.toMatch(/habitat footprint|Home construction/i);
  });

  it("splits gendered food and labels content packs", () => {
    expect(foodEntries("Male: Sour Flavors; Female: Spicy flavors")).toEqual([
      { flavor: "Sour", label: "Male: Sour" },
      { flavor: "Spicy", label: "Female: Spicy" },
    ]);
    expect(contentLabel(null, "base")).toBe("Base game");
    expect(contentLabel(null, "expansion-pass")).toBe(
      "Bubbly Basin expansion",
    );
  });

  it("parses environment-level unlock text in every wording the catalog uses", () => {
    expect(parseEnvLevel("Shop – Bubbly Basin (Env. level 10)")).toEqual({
      area: "Bubbly Basin",
      level: 10,
    });
    expect(parseEnvLevel("Shop - Bubbly Basin Lv. 4 · Expansion Pass only")).toEqual(
      { area: "Bubbly Basin", level: 4 },
    );
    expect(parseEnvLevel("Shop - Palette Town Lv. 9")).toEqual({
      area: "Palette Town",
      level: 9,
    });
    expect(parseEnvLevel("Shop (as bundle) - Withered Wastelands Lv. 5")).toEqual(
      { area: "Withered Wastelands", level: 5 },
    );
    expect(parseEnvLevel("Shop as bundle (Sparkling Skylands Lv. 6)")).toEqual({
      area: "Sparkling Skylands",
      level: 6,
    });
    expect(parseEnvLevel("Shop - Unlocked at Cloud Island Lv. 4")).toEqual({
      area: "Cloud Island",
      level: 4,
    });
    expect(
      parseEnvLevel("Shop after reaching Bubbly Basin Level 5 · Expansion Pass only"),
    ).toEqual({ area: "Bubbly Basin", level: 5 });
    expect(parseEnvLevel("Shop - Palette Town lLv. 4")).toEqual({
      area: "Palette Town",
      level: 4,
    });
    expect(parseEnvLevel("Shop – Today Only section")).toBeNull();
    expect(parseEnvLevel("Randomly found in whirlpool")).toBeNull();
    expect(parseEnvLevel(null)).toBeNull();

    // The parser reads recipeLocation, locations, and recipeMeta.unlock
    // methods alike, since the catalog spreads the same shop-unlock fact
    // across whichever of those fields a given import source populated.
    const bonfire = catalog.items.find((item) => item.name === "Bonfire")!;
    expect(itemEnvRequirements(bonfire)).toEqual(
      expect.arrayContaining([
        { area: "Withered Wastelands", level: 5 },
        { area: "Cloud Island", level: 5 },
      ]),
    );
  });

  it("shows every town in the level popup, not just Bubbly Basin", () => {
    const areas = catalogEnvLevelAreas();
    expect(areas.map((a) => a.area)).toEqual([...ENV_LEVEL_TOWNS]);
    expect(areas.every((a) => a.maxLevel === 10)).toBe(true);
  });

  it("defaults Withered Wastelands to level 3 and every other town to 1", () => {
    expect(recordedEnvLevel("Withered Wastelands", {})).toBe(3);
    expect(recordedEnvLevel("Withered Wastelands", undefined)).toBe(3);
    expect(recordedEnvLevel("Bubbly Basin", {})).toBe(1);
    expect(recordedEnvLevel("Cloud Island", {})).toBe(1);
    expect(recordedEnvLevel("Bubbly Basin", { "Bubbly Basin": 8 })).toBe(8);
    expect(recordedEnvLevel("Bubbly Basin", { "Bubbly Basin": 0 })).toBe(1);
  });

  it("locks a requirement only until its town's level is reached", () => {
    expect(
      isEnvLevelLocked({ area: "Bubbly Basin", level: 10 }, { "Bubbly Basin": 4 }),
    ).toBe(true);
    expect(
      isEnvLevelLocked({ area: "Bubbly Basin", level: 10 }, { "Bubbly Basin": 10 }),
    ).toBe(false);
    expect(isEnvLevelLocked({ area: "Bubbly Basin", level: 10 }, {})).toBe(true);
    expect(isEnvLevelLocked({ area: "Withered Wastelands", level: 3 }, {})).toBe(
      false,
    );
  });

  it("locks an item only when every recorded route is unmet", () => {
    // Single shop route, above the default level: locked, and reports it.
    expect(itemEnvLock({ recipeLocation: "Shop – Bubbly Basin (Env. level 10)" }, {})).toEqual(
      { area: "Bubbly Basin", level: 10 },
    );
    // Raising that town's level clears the lock.
    expect(
      itemEnvLock(
        { recipeLocation: "Shop – Bubbly Basin (Env. level 10)" },
        { "Bubbly Basin": 10 },
      ),
    ).toBeNull();
    // Two shop routes: meeting either one unlocks it.
    expect(
      itemEnvLock(
        {
          locations: [
            "Shop - Unlocked at Withered Wastelands Lv. 5",
            "Shop - Unlocked at Cloud Island Lv. 5",
          ],
        },
        { "Cloud Island": 5 },
      ),
    ).toBeNull();
    // Neither shop route met, but a craftable/natural route exists: not locked.
    expect(
      itemEnvLock(
        {
          locations: [
            "Shop - Unlocked at Withered Wastelands Lv. 5",
            "Craft from recipe",
          ],
        },
        {},
      ),
    ).toBeNull();
    // Neither route met and no alternate: locked, reporting the lower level.
    expect(
      itemEnvLock(
        {
          locations: [
            "Shop - Unlocked at Withered Wastelands Lv. 9",
            "Shop - Unlocked at Cloud Island Lv. 6",
          ],
        },
        {},
      ),
    ).toEqual({ area: "Cloud Island", level: 6 });
    // No recorded requirement at all: never locked.
    expect(itemEnvLock({ locations: ["Withered Wastelands (Natural)"] }, {})).toBeNull();
    expect(itemEnvLock({}, {})).toBeNull();
  });

  it("resolves every ideal-environment example id against the catalog", () => {
    const ids = allEnvironmentExampleIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(catalog.items.find((item) => item.id === id), id).toBeTruthy();
    }
    for (const value of ENVIRONMENT_VALUES) {
      expect(environmentExampleIds(value).length).toBeGreaterThan(0);
    }
  });
});
