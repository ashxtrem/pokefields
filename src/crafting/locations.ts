import type { NormalizedRecipe, RecipeIngredient } from "./types";

export function hasRecordedUnlock(recipe: NormalizedRecipe) {
  return (
    recipe.unlock.methods.length > 0 || recipe.unlock.conflicts.length > 0
  );
}

export function summarizeLocations(locations: string[]): string {
  const natural = locations.filter((line) => /\(\s*Natural\s*\)/i.test(line))
    .length;
  const shop = locations.some((line) => /\bshop\b/i.test(line));
  const action = locations.some(
    (line) =>
      /smelt|destroy|furnace|tall grass|on beaches|talk to/i.test(line) &&
      !/\bshop\b/i.test(line),
  );
  const bits: string[] = [];
  if (natural) bits.push(`${natural} natural area${natural === 1 ? "" : "s"}`);
  if (shop) bits.push("shop unlock");
  if (action) bits.push("action");
  if (!bits.length && locations.length) {
    bits.push(
      `${locations.length} recorded ${locations.length === 1 ? "source" : "sources"}`,
    );
  }
  return bits.join(" · ");
}

export function ingredientCountLabel(row: RecipeIngredient) {
  return `× ${row.quantity}`;
}
