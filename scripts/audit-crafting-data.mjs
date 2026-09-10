import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const catalog = JSON.parse(await readFile("public/data/catalog.json", "utf8"));
const aliases = JSON.parse(
  await readFile("src/crafting/data/aliases.json", "utf8"),
);
const enrichment = JSON.parse(
  await readFile("src/crafting/data/enrichment.json", "utf8"),
);
const licensing = await readFile(
  "docs/research/crafting-licensing.md",
  "utf8",
);
let extraction = null;
try {
  extraction = JSON.parse(
    await readFile(".cache/crafting-extraction.json", "utf8"),
  );
} catch {}

const normalize = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const items = catalog.items;
const candidates = items.filter((item) => item.recipe?.length);
const hash = createHash("sha256")
  .update(JSON.stringify(catalog.items.map((i) => i.id).sort()))
  .digest("hex")
  .slice(0, 16);

function resolveLabel(label) {
  const aliasId = aliases[normalize(label)];
  if (aliasId && items.some((item) => item.id === aliasId)) {
    return { type: "alias", itemId: aliasId };
  }
  const hits = items.filter((item) => normalize(item.name) === normalize(label));
  if (hits.length === 1) return { type: "exact", itemId: hits[0].id };
  if (hits.length > 1) return { type: "ambiguous", itemIds: hits.map((h) => h.id) };
  return { type: "unresolved" };
}

const identity = { exact: 0, alias: 0, ambiguous: 0, unresolved: [] };
const invalidQuantities = [];
const duplicateIngredients = [];
let ingredientsWithLocations = 0;
let ingredientOccurrences = 0;
for (const item of candidates) {
  const seen = new Set();
  for (const part of item.recipe) {
    ingredientOccurrences += 1;
    const resolved = resolveLabel(part.name);
    if (resolved.type === "exact") identity.exact++;
    else if (resolved.type === "alias") identity.alias++;
    else if (resolved.type === "ambiguous") identity.ambiguous++;
    else identity.unresolved.push({ itemId: item.id, label: part.name });
    const material =
      resolved.type === "exact" || resolved.type === "alias"
        ? items.find((row) => row.id === resolved.itemId)
        : null;
    if (material?.locations?.length) ingredientsWithLocations += 1;
    if (!Number.isSafeInteger(part.quantity) || part.quantity < 1) {
      invalidQuantities.push({ itemId: item.id, label: part.name, quantity: part.quantity });
    }
    const key = normalize(part.name);
    if (seen.has(key)) duplicateIngredients.push({ itemId: item.id, label: part.name });
    seen.add(key);
  }
}

const withLocation = items.filter((item) => item.recipeLocation);
const locationWithoutRecipe = withLocation.filter((item) => !item.recipe?.length);
const craftWithoutRecipe = items.filter(
  (item) =>
    (item.locations || []).some((line) => /craft from recipe/i.test(line)) &&
    !item.recipe?.length,
);
const kinds = { craft: 0, cook: 0, neither: 0 };
for (const item of candidates) {
  const loc = (item.locations || []).join(" ");
  if (/cook with ingredients/i.test(loc)) kinds.cook++;
  else if (/craft from recipe/i.test(loc)) kinds.craft++;
  else kinds.neither++;
}
const specialty = candidates.filter((item) => item.recipeSpecialty).length;
const cookingDefaultQuantities = candidates.filter((item) => {
  const loc = (item.locations || []).join(" ");
  return (
    /cook with ingredients/i.test(loc) &&
    item.recipe.every((part) => part.quantity === 1)
  );
}).length;

const recordedUnlock = candidates.filter(
  (item) => item.recipeMeta?.unlock?.methods?.length,
);
const conflictingUnlock = candidates.filter(
  (item) => item.recipeMeta?.unlock?.conflicts?.length,
);
const recovered = candidates.filter(
  (item) =>
    item.recipeMeta?.unlock?.methods?.length &&
    !item.recipeLocation &&
    item.recipeMeta?.extraction?.itemPage !== "fetch-failed",
);
const confirmedAbsent = candidates.filter(
  (item) =>
    !item.recipeMeta?.unlock?.methods?.length &&
    item.recipeMeta?.extraction?.itemPage &&
    item.recipeMeta.extraction.itemPage !== "fetch-failed",
);
const unreachable = candidates.filter(
  (item) => item.recipeMeta?.extraction?.itemPage === "fetch-failed",
);

const overlayIds = Object.keys(enrichment.records || {});
const conflicts = [
  ...new Set([
    ...overlayIds.filter((id) => enrichment.records[id].conflicts?.length),
    ...candidates
      .filter((item) => item.recipeMeta?.conflicts?.length)
      .map((item) => item.id),
  ]),
];

const report = {
  catalogVersion: catalog.version,
  catalogItemIdHash: hash,
  generatedAt: new Date().toISOString().slice(0, 10),
  licensing: {
    decisionId: "D-LIC-01",
    outcome: "no-bulkapedia-bundle",
    document: "docs/research/crafting-licensing.md",
    excerpt: licensing.split("## Outcome")[1]?.split("##")[0]?.trim() || "",
  },
  extraction,
  counts: {
    items: items.length,
    recipeCandidates: candidates.length,
    nonemptyRecipeLocation: withLocation.length,
    recipeLocationWithoutIngredients: locationWithoutRecipe.map((i) => i.id),
    craftFromRecipeWithoutIngredients: craftWithoutRecipe.map((i) => i.id),
    kinds,
    specialtyRecorded: specialty,
    cookingImporterDefaultQuantities: cookingDefaultQuantities,
    invalidQuantities,
    duplicateIngredients,
    identity,
    ingredientOccurrences,
    ingredientsWithLocations,
    unlock: {
      beforeRecipeLocation: withLocation.filter((item) => item.recipe?.length)
        .length,
      afterRecordedMethods: recordedUnlock.length,
      recoveredFromSerebii: recovered.length,
      confirmedAbsentUpstream: confirmedAbsent.length,
      notReachable: unreachable.length,
      conflicting: conflictingUnlock.length,
    },
    enrichmentRecords: overlayIds,
    conflictItemIds: conflicts,
  },
};

await writeFile(
  "docs/research/crafting-audit.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  "Crafting audit",
  report.counts.recipeCandidates,
  "candidates",
  report.counts.unlock.afterRecordedMethods,
  "recorded unlocks",
  report.counts.identity.unresolved.length,
  "unresolved after aliases",
);
