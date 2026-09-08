import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import type { Catalog } from "../src/catalog/types";
import { generatePlan, canPlace, furnishings } from "../src/planner/engine";
import { recommendHousemates } from "../src/planner/recommend";
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
  it("uses actual items rather than category index links", () => {
    expect(
      catalog.items.some((i) =>
        ["decoration", "toy", "relaxation"].includes(i.id),
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
        const kit = catalog.kits.find((k) => k.id === h.kitId)!;
        return h.residents.length <= kit.capacity;
      }),
    ).toBe(true);
  });
});
