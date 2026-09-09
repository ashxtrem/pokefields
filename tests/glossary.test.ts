import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import type { Catalog } from "../src/catalog/types";
import {
  allEnvironmentExampleIds,
  contentLabel,
  ENVIRONMENT_VALUES,
  environmentExampleIds,
  explainTerm,
  foodEntries,
  habitatImageUrl,
  itemImageUrl,
  parseRequirement,
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
    expect(flower.categories).toEqual([
      "Soft stuff",
      "Cute stuff",
      "Group activities",
      "Pretty flowers",
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
