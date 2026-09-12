import { readFile, writeFile } from "node:fs/promises";

/**
 * Assigns theme `tags` to catalog items by keyword-matching their names.
 *
 * This is a heuristic browsing aid layered on top of the catalog, not part of
 * the independently-extracted-fact pipeline `scripts/import-data.mjs` runs —
 * it reads the already-built catalog and needs no network access or cache.
 * See docs/items-directory-plan.md and README.md for why sourced facts
 * (groups, collection) and this heuristic layer (tags) are kept distinct.
 *
 * Run: `npm run data:tag`. Review `docs/research/tag-report.json` afterward
 * and tune TAG_RULES for obvious misfires before trusting the output.
 */

const CATALOG_PATH = "public/data/catalog.json";
const REPORT_PATH = "docs/research/tag-report.json";

// Pokémon-type tags, plus a small set of custom themes types don't cover.
// Order is display order; ids are what's stored on Item.tags.
export const TAG_RULES = [
  { id: "fire", label: "Fire", keywords: [/\bfire\b/i, /\bflame/i, /\bember/i, /\bblaze/i, /\bvolcano/i, /\bcandle/i, /\blava\b/i] },
  { id: "water", label: "Water", keywords: [/\bwater\b/i, /\bwave/i, /\bsea\b/i, /\bocean/i, /\blake\b/i, /\bpond\b/i, /\baqua/i, /\bcoral/i, /\bshell\b/i, /\bfountain/i] },
  { id: "flying", label: "Flying", keywords: [/\bwing/i, /\bfeather/i, /\bbird/i, /\bnest\b/i, /\bkite\b/i] },
  { id: "grass", label: "Grass", keywords: [/\bleaf\b/i, /\bleaves\b/i, /\bplant/i, /\bflower/i, /\btree\b/i, /\bgrass\b/i, /\bbloom/i, /\bvine\b/i, /\bblossom/i, /\bpetal/i] },
  { id: "electric", label: "Electric", keywords: [/\belectric/i, /\bspark/i, /\bbolt\b/i, /\bbattery/i, /\blightning/i, /\bneon\b/i] },
  { id: "ice", label: "Ice", keywords: [/\bice\b/i, /\bsnow/i, /\bfrost/i, /\bfrozen/i, /\bicicle/i, /\bglacier/i] },
  { id: "rock", label: "Rock", keywords: [/\brock\b/i, /\bstone\b/i, /\bboulder/i, /\bpebble/i, /\bgravel/i] },
  { id: "ground", label: "Ground", keywords: [/\bsand\b/i, /\bdirt\b/i, /\bdesert/i, /\bdune\b/i] },
  { id: "bug", label: "Bug", keywords: [/\bbug\b/i, /\binsect/i, /\bbeetle/i, /\bcocoon/i, /\bspider/i, /\bweb\b/i] },
  { id: "ghost", label: "Ghost", keywords: [/\bghost/i, /\bspooky/i, /\bpumpkin/i, /\bskull/i, /\btombstone/i, /\bhalloween/i] },
  { id: "steel", label: "Steel", keywords: [/\bmetal\b/i, /\biron\b/i, /\bsteel\b/i, /\bcopper/i, /\bbronze/i, /\btin\b/i] },
  { id: "psychic", label: "Psychic", keywords: [/\bcrystal/i, /\bgem\b/i, /\borb\b/i, /\bmystic/i] },
  { id: "dragon", label: "Dragon", keywords: [/\bdragon/i, /\bscale\b/i] },
  { id: "dark", label: "Dark", keywords: [/\bshadow/i, /\bnight\b/i] },
  { id: "fairy", label: "Fairy", keywords: [/\bfairy/i, /\bribbon/i, /\bsparkle/i, /\bglitter/i] },
  { id: "poison", label: "Poison", keywords: [/\bpoison/i, /\bvenom/i, /\btoxic/i] },
  { id: "seasonal-holiday", label: "Seasonal & holiday", keywords: [/\bchristmas/i, /\bholiday/i, /\beaster/i, /\bvalentine/i, /\bbirthday/i, /\bfestive/i, /\bwreath\b/i, /\bparty\b/i] },
  { id: "space-sky", label: "Space & sky", keywords: [/\bstar\b/i, /\bstars\b/i, /\bmoon\b/i, /\bplanet/i, /\brocket/i, /\bgalaxy/i, /\bcomet/i, /\bcloud\b/i] },
  { id: "music-sound", label: "Music & sound", keywords: [/\bmusic\b/i, /\bnote\b/i, /\bdrum\b/i, /\bguitar/i, /\bspeaker/i, /\bradio\b/i] },
  { id: "vintage-antique", label: "Vintage & antique", keywords: [/\bantique/i, /\bvintage/i] },
];

export function tagsForName(name) {
  const matches = TAG_RULES.filter((rule) =>
    rule.keywords.some((re) => re.test(name)),
  ).map((rule) => rule.id);
  return matches.sort();
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const perTag = new Map(TAG_RULES.map((rule) => [rule.id, []]));
  let taggedCount = 0;

  for (const item of catalog.items) {
    const tags = tagsForName(item.name);
    if (tags.length) {
      item.tags = tags;
      taggedCount++;
      for (const tag of tags) perTag.get(tag).push(item.name);
    } else {
      delete item.tags;
    }
  }

  const [datePart, seq] = String(catalog.version).split(/\.(?=\d+$)/);
  catalog.version = seq && /^\d+$/.test(seq)
    ? `${datePart}.${Number(seq) + 1}`
    : `${catalog.version}.1`;

  await writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");

  const report = {
    items: catalog.items.length,
    tagged: taggedCount,
    untagged: catalog.items.length - taggedCount,
    tags: Object.fromEntries(
      TAG_RULES.map((rule) => [
        rule.id,
        { label: rule.label, count: perTag.get(rule.id).length, items: perTag.get(rule.id).sort() },
      ]),
    ),
  };
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");

  console.log(
    `Tagged ${taggedCount} of ${catalog.items.length} items. Catalog version -> ${catalog.version}. Report: ${REPORT_PATH}`,
  );
}

main();
