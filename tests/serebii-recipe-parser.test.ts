import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ingredientBundleKey,
  parseCraftingIndex,
  parseSerebiiItemRecipe,
} from "../scripts/serebii-recipe.mjs";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("Serebii recipe parser", () => {
  it("reads unlock lines and ingredients from a Recipe section", () => {
    const parsed = parseSerebiiItemRecipe(
      fixture("serebii-recipe-section.html"),
      "https://www.serebii.net/pokemonpokopia/items/plainstool.shtml",
    );
    expect(parsed.hasRecipeSection).toBe(true);
    expect(parsed.unlockLines).toEqual([
      "Daily Shop Special",
      "Sparkling Water",
    ]);
    expect(parsed.ingredients).toEqual([
      { name: "Lumber", quantity: 1, id: "lumber" },
      { name: "Twine", quantity: 1, id: "twine" },
    ]);
  });

  it("does not invent a Recipe section from item locations", () => {
    const parsed = parseSerebiiItemRecipe(fixture("serebii-no-recipe.html"));
    expect(parsed.hasRecipeSection).toBe(false);
    expect(parsed.unlockLines).toEqual([]);
    expect(parsed.ingredients).toEqual([]);
  });

  it("keeps a disagreeing ingredient list so the importer can record it without merging", () => {
    const parsed = parseSerebiiItemRecipe(
      fixture("serebii-ingredient-disagree.html"),
    );
    const api = [{ name: "Lumber", quantity: 2 }];
    expect(parsed.ingredients).toEqual([
      { name: "Lumber", quantity: 99, id: "lumber" },
    ]);
    expect(ingredientBundleKey(parsed.ingredients)).not.toBe(
      ingredientBundleKey(api),
    );
  });

  it("parses crafting.shtml index rows", () => {
    const html = `
      <table class="dextable">
        <tr>
          <td class="fooevo">Picture</td>
          <td class="fooevo">Name</td>
          <td class="fooevo">Locations</td>
          <td class="fooevo">Requirements</td>
        </tr>
        <tr>
          <td class="cen"><a href="items/storagebox.shtml">Storage Box</a></td>
          <td class="cen"><a href="items/storagebox.shtml">Storage Box</a></td>
          <td class="fooinfo">Register 6 Pokémon</td>
          <td class="fooinfo">
            <table>
              <tr><td><a href="items/lumber.shtml"><u>Lumber</u></a> * 1</td></tr>
            </table>
          </td>
        </tr>
      </table>
    `;
    expect(parseCraftingIndex(html, "https://example/crafting.shtml")).toEqual([
      {
        id: "storagebox",
        unlockLines: ["Register 6 Pokémon"],
        ingredients: [{ name: "Lumber", quantity: 1, id: "lumber" }],
        pageUrl: "https://example/crafting.shtml",
      },
    ]);
  });
});
