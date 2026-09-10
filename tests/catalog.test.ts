import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { plannableKitMap, type Catalog } from "../src/catalog/types";
import { generatePlan, canPlace, furnishings } from "../src/planner/engine";
import { recommendHousemates } from "../src/planner/recommend";
import { listRecipes } from "../src/crafting/catalog";
const catalog = JSON.parse(
  readFileSync("public/data/catalog.json", "utf8"),
) as Catalog;
describe("shipped reference catalog", () => {
  it("keeps all three dexes and stable unique identifiers", () => {
    expect(new Set(catalog.pokemon.map((p) => p.id)).size).toBe(
      catalog.pokemon.length,
    );
    expect(
      ["regular", "event", "basin"].map(
        (d) => catalog.pokemon.filter((p) => p.dex === d).length,
      ),
    ).toEqual([308, 7, 50]);
  });
  it("uses official national numbers for species artwork", () => {
    expect(catalog.pokemon.find((p) => p.id === "gholdengo")?.nationalNumber).toBe(
      1000,
    );
    expect(catalog.pokemon.find((p) => p.id === "voltorb")?.nationalNumber).toBe(
      100,
    );
    expect(catalog.pokemon.find((p) => p.id === "electrode")?.nationalNumber).toBe(
      101,
    );
  });
  it("includes habitat-only Serebii items used as requirement icons", () => {
    expect(catalog.items.find((i) => i.id === "seamoss")?.name).toMatch(
      /sea moss/i,
    );
    expect(catalog.items.find((i) => i.id === "chimneyrocks")?.name).toMatch(
      /chimney rocks/i,
    );
    expect(catalog.items.find((i) => i.id === "bed")?.name).toMatch(/bed/i);
    expect(catalog.items.find((i) => i.id === "limestone")?.name).toMatch(
      /limestone/i,
    );
  });
  it("includes environment examples, flooring, and gatherables from the full Serebii item list", () => {
    expect(catalog.version).toBe("2026-09-10.2");
    expect(catalog.items.length).toBeGreaterThanOrEqual(1700);
    for (const id of [
      "icyrock",
      "heatrock",
      "stonehousekit",
      "sanddenkit",
      "freezingchamberskit",
      "honey",
      "diploma",
      "flowertable",
      "tatamimat",
      "glowingmushrooms",
    ]) {
      expect(catalog.items.find((i) => i.id === id), id).toBeTruthy();
    }
  });
  it("includes Serebii food items used as flavor examples", () => {
    expect(catalog.items.find((i) => i.id === "freshcarrot")?.name).toMatch(
      /carrot/i,
    );
    expect(catalog.items.find((i) => i.id === "chilisauce")?.name).toMatch(
      /chili/i,
    );
    expect(catalog.items.find((i) => i.id === "pechaberry")?.name).toMatch(
      /pecha/i,
    );
    expect(catalog.items.find((i) => i.id === "leppasalad")?.name).toMatch(
      /salad/i,
    );
    expect(catalog.items.find((i) => i.id === "mushroomsoup")?.name).toMatch(
      /soup/i,
    );
  });
  it("stores Serebii cooking recipes on cooked dishes", () => {
    expect(catalog.items.find((i) => i.id === "seaweedsalad")?.recipe).toEqual([
      { name: "Leaf", quantity: 1 },
      { name: "Seaweed", quantity: 1 },
    ]);
    expect(
      catalog.items.find((i) => i.id === "shreddedsalad")?.recipeSpecialty,
    ).toBe("Chop");
  });
  it("normalizes recipes without inventing yield or prefix-matching ingredients", () => {
    const recipes = listRecipes(catalog);
    expect(recipes.length).toBe(885);
    const carved = recipes.find((recipe) => recipe.outputItemId === "carvedlight-brownrock");
    expect(carved?.ingredients[0].identity).toEqual({
      type: "resolved",
      itemId: "lightbrownrock",
    });
    const steps = recipes.find((recipe) => recipe.outputItemId === "woodensteps");
    expect(steps?.conflicts.length).toBeGreaterThan(0);
  });
  it("uses actual items rather than category index links", () => {
    expect(
      catalog.items.some((i) =>
        ["decoration", "relaxation"].includes(i.id),
      ),
    ).toBe(false);
    expect(
      catalog.items.find((i) => i.id === "berrycase")?.categories,
    ).toContain("Lots of nature");
    const p = catalog.pokemon.find((p) => p.id === "bulbasaur")!;
    const setup = furnishings([p], catalog.items);
    expect(setup.selected.length).toBeGreaterThan(1);
    expect(setup.uncovered).toEqual([]);
  });
  it("records habitat requirements and areas independently from player discoveries", () => {
    const h = catalog.pokemon
      .find((p) => p.id === "bulbasaur")!
      .habitats.find((h) => h.id === "tallgrass")!;
    expect(h.requirements).toContain("4 × Tall Grass");
    expect(h.areas.length).toBeGreaterThan(1);
    expect(h.image).toBe(
      "https://www.serebii.net/pokemonpokopia/habitatdex/1.png",
    );
  });
  it("keeps food differences for both Frillish and Jellicent forms", () => {
    for (const name of ["Frillish", "Jellicent"]) {
      const p = catalog.pokemon.find((p) => p.name === name)!;
      expect(p.food).toMatch(/Male:.*Female:/);
      expect(p.additionalSources).toHaveLength(1);
    }
  });
  it("does not include size-restricted dens without size eligibility", () => {
    expect(catalog.kits.some((k) => k.id.includes("denkit"))).toBe(false);
  });
  it("records the item index's own sections without inferring one", () => {
    // Sections are a set: this item is listed twice on the index.
    expect(catalog.items.find((i) => i.id === "luckyegg")?.groups).toEqual([
      "Other",
      "Lost Relics (S)",
    ]);
    expect(catalog.items.find((i) => i.id === "honey")?.groups).toEqual([
      "Materials",
    ]);
    // Section labels are stored in the source's own wording.
    expect(catalog.items.find((i) => i.id === "pikachudoll")?.groups).toEqual([
      "Misc.",
    ]);
    const unsorted = catalog.items.filter((i) => !i.groups?.length);
    expect(unsorted.length).toBeGreaterThan(0);
    // An item the index does not list stays unsorted rather than being placed.
    expect(unsorted.every((i) => i.groups === undefined)).toBe(true);
  });
  it("numbers music discs from the index and does not close the set", () => {
    const disc = catalog.items.find((i) => i.id === "pallettown");
    expect(disc?.collection).toEqual({ set: "music-cd", number: 2 });
    const discs = catalog.items.filter((i) => i.collection?.set === "music-cd");
    const highest = Math.max(...discs.map((i) => i.collection!.number));
    // The set is known to be incomplete upstream; coverage must not be
    // reported as complete by counting only what is documented.
    expect(highest).toBeGreaterThan(discs.length);
  });
  it("never stores the description text a derived fact was read from", () => {
    for (const item of catalog.items)
      expect(Object.keys(item)).not.toContain("description");
  });
  it("keeps structures out of the plannable kit list", () => {
    const structures = catalog.kits.filter((k) => k.kind !== "residence");
    expect(structures.length).toBeGreaterThan(0);
    expect(catalog.kits.find((k) => k.id === "concertstagekit")?.kind).toBe(
      "structure",
    );
    // A blank capacity cell is not a documented zero, so no claim is made.
    expect(catalog.kits.find((k) => k.id === "aquacottagekit")?.kind).toBe(
      "unknown",
    );
    const plannable = plannableKitMap(catalog.kits);
    expect(structures.every((k) => !plannable.has(k.id))).toBe(true);
    // The homes the planner may use are unchanged by admitting structures.
    expect(plannable.size).toBe(26);
  });
  it("keeps kits whose footprint the source never records, unplannable", () => {
    const centre = catalog.kits.find((k) => k.id === "beachpokemoncenterkit");
    expect(centre).toBeDefined();
    expect(centre!.width).toBeNull();
    expect(plannableKitMap(catalog.kits).has("beachpokemoncenterkit")).toBe(
      false,
    );
  });
  it("plans a full catalog roster within selected boundaries and capacity", () => {
    const input = {
      area: catalog.areas[0],
      roster: catalog.pokemon.map((p) => p.id),
      plot: { width: 100, depth: 100 },
      kits: [{ id: "leafhousekit", limit: null }],
    };
    const plan = generatePlan(input, catalog);
    expect(
      plan.homes.flatMap((h) => h.residents).length + plan.unplaced.length,
    ).toBe(365);
    expect(
      plan.homes.every(
        (h) =>
          canPlace(h, plan.homes, plan.plot, catalog) &&
          h.residents.length <= 4,
      ),
    ).toBe(true);
    expect(
      plan.homes.every(
        (h) =>
          new Set(
            h.residents.map(
              (id) => catalog.pokemon.find((p) => p.id === id)!.environment,
            ),
          ).size <= 1,
      ),
    ).toBe(true);
  });
  it("recommends housemates for the full roster without a plot", () => {
    const plan = recommendHousemates(
      {
        roster: catalog.pokemon.map((p) => p.id),
        sourceRoster: catalog.pokemon.map((p) => p.id),
        areaFilter: null,
      },
      catalog,
    );
    const housed = plan.homes.flatMap((h) => h.residents);
    expect(housed.length + plan.unresolved.length).toBe(365);
    expect(new Set(housed).size).toBe(housed.length);
    expect(
      plan.homes.every((h) => {
        const kit = plannableKitMap(catalog.kits).get(h.kitId)!;
        return h.residents.length <= kit.capacity;
      }),
    ).toBe(true);
  });
});
