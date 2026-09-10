import { load } from "cheerio";

function cellLines($, el) {
  const html = $(el).html() || "";
  return html
    .split(/<br\s*\/?\s*>/i)
    .map((chunk) =>
      load(`<div>${chunk}</div>`)("div")
        .text()
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

export function parseIngredientTable($, table) {
  const ingredients = [];
  $(table)
    .find("tr")
    .each((_, tr) => {
      const rowText = $(tr).text().replace(/\s+/g, " ").trim();
      const match = rowText.match(/^(.*)\*\s*(\d+)\s*$/);
      if (!match) return;
      const name = match[1].replace(/\s+/g, " ").trim();
      const quantity = Number(match[2]);
      if (!name || !Number.isSafeInteger(quantity) || quantity < 1) return;
      const href = $(tr).find("a[href*='.shtml']").last().attr("href") || "";
      const id = (href.split("/").pop() || "")
        .replace(/\.shtml.*/i, "")
        .trim();
      ingredients.push({ name, quantity, id: id || null });
    });
  return ingredients;
}

function itemIdFromHref(href) {
  if (!href) return null;
  const file = href.split("/").pop() || "";
  const id = file.replace(/\.shtml.*/i, "").trim();
  return id || null;
}

/**
 * Parse a Serebii item page Recipe section.
 * Location here is unlock guidance, never the finished item's acquire list.
 */
export function parseSerebiiItemRecipe(html, pageUrl = "") {
  const $ = load(html);
  const heading = $("h2").filter(
    (_, el) => $(el).text().replace(/\s+/g, " ").trim() === "Recipe",
  );
  if (!heading.length) {
    return {
      pageUrl,
      hasRecipeSection: false,
      unlockLines: [],
      ingredients: [],
    };
  }
  const table = heading.closest("table");
  const locationLabel = table
    .find("td.fooblack")
    .filter((_, el) => $(el).text().replace(/\s+/g, " ").trim() === "Location")
    .first();
  const unlockLines = locationLabel.length
    ? cellLines($, locationLabel.next("td"))
    : [];
  const nested = table.find("table").first();
  const ingredients = nested.length ? parseIngredientTable($, nested) : [];
  return {
    pageUrl,
    hasRecipeSection: true,
    unlockLines,
    ingredients,
  };
}

/** Parse crafting.shtml's per-item Locations / Requirements table. */
export function parseCraftingIndex(html, pageUrl = "") {
  const $ = load(html);
  const rows = [];
  $("table.dextable tr").each((_, tr) => {
    const cells = $(tr).children("td");
    if (cells.length < 4) return;
    const href =
      $(cells.eq(1)).find("a[href*='items/']").attr("href") ||
      $(cells.eq(0)).find("a[href*='items/']").attr("href") ||
      "";
    const id = itemIdFromHref(href);
    if (!id || id === "items") return;
    const unlockLines = cellLines($, cells.eq(2));
    const ingredients = parseIngredientTable($, cells.eq(3));
    rows.push({ id, unlockLines, ingredients, pageUrl });
  });
  return rows;
}

export function foldUnlockText(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function ingredientBundleKey(parts) {
  return (parts || [])
    .map((part) => {
      const name = String(part.name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      return `${name}:${part.quantity}`;
    })
    .sort()
    .join("|");
}
