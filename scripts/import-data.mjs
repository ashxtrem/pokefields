import { load } from "cheerio";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
async function pool(values, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (i < values.length) {
        const index = i++;
        await fn(values[index], index);
      }
    }),
  );
}
await mkdir(".cache/sources", { recursive: true });
const origin = "https://www.serebii.net";
async function get(url) {
  const file =
    ".cache/sources/" + createHash("sha256").update(url).digest("hex");
  try {
    return await readFile(file, "utf8");
  } catch {}
  // curl uses the host certificate store, which is needed in this workspace.
  const { stdout: raw } = await run(
    "curl",
    ["--fail", "-sSL", "--max-time", "25", url],
    { maxBuffer: 8e6, encoding: "buffer" },
  );
  const text = url.includes("serebii")
    ? new TextDecoder("windows-1252").decode(raw)
    : raw.toString("utf8");
  await writeFile(file, text);
  return text;
}
const text = ($, el) => $(el).text().replace(/\s+/g, " ").trim();
const names = ($, selector) => [
  ...new Set(
    $(selector)
      .toArray()
      .map((e) => text($, e) || $(e).find("img").attr("alt"))
      .filter(Boolean),
  ),
];
const categoryName = (s) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const itemsOnly = process.argv.includes("--items-only");
const itemMap = new Map();
function itemIdFromSrc(srcAttr) {
  if (!srcAttr) return null;
  try {
    const file = new URL(srcAttr, origin).pathname.split("/").pop() || "";
    const id = file.replace(/\.png$/i, "");
    return id || null;
  } catch {
    return null;
  }
}
function ensureItem(id, name) {
  const trimmed = (name || "").replace(/\s+/g, " ").trim();
  if (!id || !trimmed || trimmed === "Name") return;
  if (itemMap.has(id)) return;
  itemMap.set(id, {
    id,
    name: trimmed,
    categories: [],
    source: `${origin}/pokemonpokopia/items/${id}.shtml`,
  });
}
const src =
  "https://raw.githubusercontent.com/QuesoCaliente/pokopiapi/893936af1adb51f6d2aab18aa8fa359fc401dd0a/";
let pokemon = [];
const habitatSources = new Map();
const favoriteSources = new Map();
const failures = [];
// PokopiaAPI stores Gholdengo as 100 (Voltorb). Official national number is 1000.
const nationalNumberFixes = { gholdengo: 1000 };
let catalogSnapshot = null;
if (itemsOnly) {
  catalogSnapshot = JSON.parse(
    await readFile("public/data/catalog.json", "utf8"),
  );
  pokemon = catalogSnapshot.pokemon;
  for (const item of catalogSnapshot.items) itemMap.set(item.id, item);
  for (const p of pokemon)
    for (const h of p.habitats)
      habitatSources.set(new URL(h.source).pathname, h.name);
  console.log("Items-only: scanning", habitatSources.size, "habitats");
} else {
  const raw = JSON.parse(await get(src + "src/data/pokemon.json"));
  await writeFile(
    "public/data/POKOPIAPI-LICENSE.txt",
    await get(src + "LICENSE"),
  );
  const catalogs = ["availablepokemon", "eventpokedex", "basinpokedex"];
  const links = new Map();
  for (const page of catalogs) {
    const $ = load(await get(`${origin}/pokemonpokopia/${page}.shtml`));
    $('main a[href*="/pokedex/"]').each((_, e) => {
      const href = $(e).attr("href");
      if (
        href?.endsWith(".shtml") &&
        !href.includes("/specialty/") &&
        !href.includes("/idealhabitat/")
      ) {
        const n = text($, e) || $(e).find("img").attr("alt");
        if (n) links.set(slug(n), origin + href);
      }
    });
  }
  await pool(raw, async (p, index) => {
  const corrected = {
    Bellosom: "Bellossom",
    "Profesor Tangrowth": "Professor Tangrowth",
    Vespiqueen: "Vespiquen",
    "Shellos Mar Este": "Shellos East Sea",
    "Gastrodon Mar Este": "Gastrodon East Sea",
    Palidachu: "Peakychu",
    Musgorlax: "Mosslax",
    "Wooper de Paldea": "Paldean Wooper",
    "Tatsugiri Forma Lánguida": "Tatsugiri Droopy Form",
    "Tatsugiri Forma Recta": "Tatsugiri Stretchy Form",
    "Tatsugiri Forma Curvada": "Tatsugiri Curly Form",
    Igglypuff: "Igglybuff",
    Torkoak: "Torkoal",
    Rotom: "Stereo Rotom",
    "Toxtricity Forma Grave": "Toxtricity Low Key Form",
    "Toxtricity Forma Aguda": "Toxtricity Amped Form",
  };
  const name = corrected[p.name] || p.name;
  const source =
    (name === "Frillish" || name === "Jellicent"
      ? `${origin}/pokemonpokopia/pokedex/${slug(name)}maleform.shtml`
      : links.get(slug(name))) ||
    `${origin}/pokemonpokopia/pokedex/${slug(name)}.shtml`;
  let $;
  try {
    $ = load(await get(source));
    if (!$("main h1").length) throw Error("No entry");
  } catch {
    failures.push(p.name);
    $ = load("<main></main>");
  }
  const main = $("main");
  const env = names($, 'main a[href*="/idealhabitat/"]')[0] || null;
  const favorites = names($, 'main a[href*="/favorites/"]').map(categoryName);
  $('main a[href*="/favorites/"]').each((_, e) =>
    favoriteSources.set(categoryName(text($, e)), origin + $(e).attr("href")),
  );
  let food = names($, 'main a[href$="/flavors.shtml"]')[0] || null;
  let additionalSources = [];
  if (name === "Frillish" || name === "Jellicent") {
    const femaleSource = source.replace("maleform", "femaleform");
    const female = load(await get(femaleSource));
    const femaleFood = names(female, 'main a[href$="/flavors.shtml"]')[0];
    food = `Male: ${food || "Unknown"}; Female: ${femaleFood || "Unknown"}`;
    additionalSources = [femaleSource];
  }
  const habitatLinks = new Map();
  main.find('a[href*="/habitatdex/"]').each((_, e) => {
    const n = text($, e);
    if (n) habitatLinks.set($(e).attr("href"), n);
  });
  const areas = names($, 'main a[href*="/locations/"]');
  const habitats = [...habitatLinks].map(([href, name]) => {
    habitatSources.set(href, name);
    return {
      id: href.split("/").pop().replace(".shtml", ""),
      name,
      image: null,
      source: origin + href,
      requirements: [],
      areas,
      rarity: "See source",
      times: [],
      weather: [],
    };
  });
  for (const h of habitats) {
    const header = main
      .find("td")
      .filter(
        (_, e) =>
          $(e).find(`a[href="${new URL(h.source).pathname}"]`).length > 0 &&
          text($, e) === h.name &&
          !$(e).find("img").length,
      )
      .first();
    const row = header.parent(),
      col = row.children("td").index(header);
    const rows = row.nextAll("tr");
    rows.each((_, r) => {
      const cell = $(r).children("td").eq(col);
      const t = text($, cell);
      if (t.startsWith("Location"))
        h.areas = names($, cell.find('a[href*="/locations/"]').toArray());
      if (t.startsWith("Rarity")) h.rarity = t.replace(/^Rarity\s*:\s*/, "");
      if (t.includes("Time") && t.includes("Weather")) {
        const cells = cell.find("table tr").last().children("td");
        h.times =
          text($, cells.eq(0)).match(/Morning|Day|Evening|Night/g) || [];
        h.weather = text($, cells.eq(1)).match(/Sun|Cloud|Rain/g) || [];
      }
    });
  }
  const timeMap = {
    Mañana: "Morning",
    Día: "Day",
    Tarde: "Evening",
    Noche: "Night",
  };
  const weatherMap = { Soleado: "Sun", Nublado: "Cloud", Lluvioso: "Rain" };
  const types = [
    ...new Set(
      $('main img[src*="/type/"]')
        .toArray()
        .map((e) => $(e).attr("alt"))
        .filter(Boolean),
    ),
  ];
  const typeFallback = {
    Planta: "Grass",
    Veneno: "Poison",
    Fuego: "Fire",
    Agua: "Water",
    Eléctrico: "Electric",
    Hielo: "Ice",
    Lucha: "Fighting",
    Tierra: "Ground",
    Volador: "Flying",
    Psíquico: "Psychic",
    Bicho: "Bug",
    Roca: "Rock",
    Fantasma: "Ghost",
    Dragón: "Dragon",
    Siniestro: "Dark",
    Acero: "Steel",
    Hada: "Fairy",
    Normal: "Normal",
  };
  pokemon.push({
    id: p.slug,
    name,
    number: String(p.localNumber),
    nationalNumber: nationalNumberFixes[p.slug] ?? p.nationalNumber,
    dex: typeof p.dex === "string" ? p.dex : p.dex?.kind || "regular",
    image: p.imageUrl,
    types: types.length
      ? types
      : (p.types || []).map((t) => typeFallback[t.name] || t.name),
    specialties: names($, 'main a[href*="/specialty/"]'),
    environment: env,
    favorites,
    food,
    habitats,
    areas,
    times: habitats.some((h) => h.times.length)
      ? [...new Set(habitats.flatMap((h) => h.times))]
      : (p.timeAvailability || []).map((t) => timeMap[t.name] || t.name),
    weather: habitats.some((h) => h.weather.length)
      ? [...new Set(habitats.flatMap((h) => h.weather))]
      : (p.climates || []).map((c) => weatherMap[c.name] || c.name),
    height: p.height,
    weight: p.weight,
    additionalSources,
    forms: (p.forms || []).map((f) =>
      typeof f === "string" ? f : f.name || f.slug || "Form",
    ),
    source,
    contentSource: p.contentSource || "base",
    event: p.event?.name || null,
    availability: p.availability || null,
    produces: p.produces || null,
    partial: !favorites.length || p.dataStatus === "partial",
  });
  if (index % 30 === 0) console.log(`Pokémon ${index + 1}/${raw.length}`);
});
}
await pool([...habitatSources], async ([href]) => {
  try {
    const $ = load(await get(origin + href));
    const heading = $("main h2")
      .filter((_, e) => text($, e) === "Requirements")
      .first();
    const table = heading.nextAll("table").first();
    const image =
      $("main img[src*='/pokemonpokopia/habitatdex/']").first().attr("src") ||
      null;
    const req = [];
    table.find("tr").each((_, row) => {
      const cells = $(row).children("td");
      if (cells.length >= 3) {
        const name = text($, cells.eq(1)),
          quantity = text($, cells.eq(2));
        ensureItem(itemIdFromSrc(cells.eq(0).find("img").attr("src")), name);
        if (name !== "Name" && name) req.push(`${quantity} × ${name}`);
      }
    });
    if (!itemsOnly) {
      for (const p of pokemon)
        for (const h of p.habitats)
          if (h.source === origin + href) {
            h.requirements = req;
            h.image = image ? new URL(image, origin).href : null;
          }
    }
  } catch {}
});
if (!itemsOnly)
await pool([...favoriteSources], async ([category, url]) => {
  try {
    const $ = load(await get(url));
    $('main a[href*="/items/"]').each((_, e) => {
      const name = text($, e);
      const href = $(e).attr("href");
      if (
        !name ||
        $(e).find("img").length > 0 ||
        !$(e)
          .closest("tr")
          .find("a")
          .toArray()
          .some((a) => $(a).attr("href") === href && $(a).find("img").length)
      )
        return;
      const id = href.split("/").pop().replace(".shtml", "");
      const item = itemMap.get(id) || {
        id,
        name,
        categories: [],
        source: origin + href,
      };
      if (!item.categories.includes(category)) item.categories.push(category);
      itemMap.set(id, item);
    });
  } catch {}
});
const $b = load(await get(origin + "/pokemonpokopia/building.shtml"));
const kitLinks = [
  ...new Set(
    $b('main a[href*="build/"]')
      .toArray()
      .map(
        (e) =>
          new URL($b(e).attr("href"), origin + "/pokemonpokopia/building.shtml")
            .pathname,
      ),
  ),
];
const kits = [];
await pool(kitLinks, async (href) => {
  try {
    const $ = load(await get(origin + href));
    const main = $("main");
    const s = text($, main);
    const width = Number(s.match(/Width:\s*(\d+)/)?.[1]);
    const depth = Number(s.match(/Depth:\s*(\d+)/)?.[1]);
    const height = Number(s.match(/Height:\s*(\d+)/)?.[1]);
    let capacity = 0,
      buildTime = "Check source";
    main.find("table").each((_, table) => {
      const rows = $(table).find("tr");
      rows.each((i, row) => {
        if (text($, row).includes("Liveable Pokémon")) {
          const cells = rows.eq(i + 1).children("td");
          capacity = Number(text($, cells.eq(2)));
          buildTime = text($, cells.eq(3));
        }
      });
    });
    if (!width || !depth || !capacity || href.includes("denkit")) return;
    const materials = [];
    main.find("tr").each((_, row) => {
      const cells = $(row).children("td");
      if (
        cells.length === 3 &&
        cells.eq(0).find('img[src*="/items/"]').length
      ) {
        const name = text($, cells.eq(1)),
          quantity = Number(text($, cells.eq(2)));
        ensureItem(
          itemIdFromSrc(cells.eq(0).find("img").attr("src")),
          name,
        );
        if (name && quantity && !materials.some((m) => m.name === name))
          materials.push({ name, quantity });
      }
    });
    main.find('a[href*="/items/"]').each((_, e) => {
      const name = text($, e);
      const href = $(e).attr("href") || "";
      ensureItem(href.split("/").pop()?.replace(".shtml", ""), name);
      const parent = $(e).parent();
      const t = text($, parent);
      const q = t.match(
        new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+(\\d+)"),
      );
      if (name && q && !materials.some((m) => m.name === name))
        materials.push({ name, quantity: Number(q[1]) });
    });
    main.find('img[src*="/items/"]').each((_, e) => {
      ensureItem(itemIdFromSrc($(e).attr("src")), $(e).attr("alt"));
    });
    // Material labels on these pages are often unlinked text beside an icon.
    if (!materials.length) {
      const section =
        main.html()?.split("<h2>Materials</h2>")[1]?.split("<h2>")[0] || "";
      for (const m of section.matchAll(
        /alt="([^"]+)"[^>]*>\s*([^<]*?)(\d+)\s*(?:<br|<\/td)/gi,
      )) {
        const name = m[1];
        if (!materials.some((x) => x.name === name))
          materials.push({ name, quantity: Number(m[3]) });
      }
    }
    const helpers = Number(s.match(/(\d+) Pokémon including/)?.[1] || 0);
    kits.push({
      id: href.split("/").pop().replace(".shtml", ""),
      name: text($, "main h1"),
      width,
      depth,
      height,
      capacity,
      helpers,
      specialties: names($, 'main a[href*="/specialty/"]'),
      materials,
      buildTime,
      source: origin + href,
    });
  } catch {}
});
const indexSkip = new Set([
  "decoration",
  "food",
  "relaxation",
  "road",
  "toy",
]);
const $index = load(await get(origin + "/pokemonpokopia/items.shtml"));
const itemsByName = new Map();
$index('a[href*="items/"]').each((_, e) => {
  const name = text($index, e);
  const href = $index(e).attr("href") || "";
  if (!name || $index(e).find("img").length) return;
  const id = href.split("/").pop()?.replace(".shtml", "");
  if (!id || indexSkip.has(id) || href.includes("itemdex")) return;
  itemsByName.set(slug(name), { id, name });
  ensureItem(id, name);
});
function ingestNamed(name) {
  const stripped = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const hit = itemsByName.get(slug(name)) || itemsByName.get(slug(stripped));
  if (hit) ensureItem(hit.id, hit.name);
}
for (const p of pokemon)
  for (const h of p.habitats)
    for (const raw of h.requirements) {
      const name = raw.replace(/^(?:\d+\s*)?×\s*/, "").trim();
      ingestNamed(name);
    }
for (const kit of itemsOnly ? catalogSnapshot.kits : kits)
  for (const m of kit.materials) ingestNamed(m.name);
for (const page of [...indexSkip]) {
  const $page = load(await get(`${origin}/pokemonpokopia/items/${page}.shtml`));
  $page("table.dextable img[src$='.png']").each((_, e) => {
    const id = itemIdFromSrc($page(e).attr("src"));
    const name = $page(e).attr("alt") || $page(e).parent().text();
    ensureItem(id, name);
  });
}
const apiItems = JSON.parse(await get(src + "src/data/items.json"));
const apiSlug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const apiById = new Map(
  apiItems.map((i) => [apiSlug(i.slug || i.name), i]),
);
const apiByName = new Map(apiItems.map((i) => [apiSlug(i.name), i]));
for (const item of itemMap.values()) {
  const hit =
    apiById.get(item.id) ||
    apiByName.get(apiSlug(item.name)) ||
    apiById.get(apiSlug(item.name));
  if (!hit) continue;
  if (hit.locations?.length) item.locations = hit.locations;
  if (hit.craftingRecipe?.length)
    item.recipe = hit.craftingRecipe.map((r) => ({
      name: r.name,
      quantity: r.quantity,
    }));
  if (hit.recipeLocation) item.recipeLocation = hit.recipeLocation;
  if (hit.event?.name) item.event = hit.event.name;
}
if (itemsOnly) {
  catalogSnapshot.items = [...itemMap.values()];
  catalogSnapshot.version = "2026-09-09.4";
  await writeFile("public/data/catalog.json", JSON.stringify(catalogSnapshot));
  await writeFile(
    "docs/research/import-report.json",
    JSON.stringify(
      {
        pokemon: catalogSnapshot.pokemon.length,
        items: catalogSnapshot.items.length,
        kits: catalogSnapshot.kits.length,
        mode: "items-only",
      },
      null,
      2,
    ),
  );
  console.log("Done items-only", catalogSnapshot.items.length, "items");
  process.exit(0);
}
const areas = [...new Set(pokemon.flatMap((p) => p.areas))].sort();
pokemon.sort((a, b) =>
  a.number.localeCompare(b.number, undefined, { numeric: true }),
);
kits.sort((a, b) => a.name.localeCompare(b.name));
const out = {
  version: "2026-09-09.4",
  pokemon,
  kits,
  items: [...itemMap.values()],
  areas,
  sources: [
    {
      name: "PokopiaAPI — BSD-3-Clause",
      url: "https://github.com/QuesoCaliente/pokopiapi",
    },
    { name: "Serebii — factual references", url: origin + "/pokemonpokopia/" },
  ],
};
await writeFile("public/data/catalog.json", JSON.stringify(out));
await writeFile(
  "docs/research/import-report.json",
  JSON.stringify(
    {
      pokemon: pokemon.length,
      preferences: pokemon.filter((p) => p.favorites.length).length,
      habitats: habitatSources.size,
      items: out.items.length,
      kits: kits.length,
      failures,
    },
    null,
    2,
  ),
);
console.log(
  "Done",
  pokemon.length,
  "Pokémon",
  kits.length,
  "kits",
  out.items.length,
  "items",
  failures.length,
  "unresolved",
);
