import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const force = process.argv.includes("--force");
const log = (msg) => process.stderr.write(msg + "\n");
// Habitat tables sometimes point at generic or typo filenames that 404.
const ITEM_IMAGE_FALLBACKS = {
  bed: "plainbed",
  lighting: "desklight",
  streetlight: "townstreetlight",
  tree: "lumtree",
  ironbeamorcolumn: "ironbeam",
  garbagebagss: "garbagebags",
  "lostrelic(large)": "largelostrelic",
  "table(large)": "plaintable",
  berrytree: "leppatree",
  vegetables: "tomato",
  furnace: "smeltingfurnace",
  treestump: "leppatreestump",
  carboadboxes: "cardboardboxes",
  cardboadboxes: "cardboardboxes",
  windmill: "windmillkit",
  moonlightdancestatue: "moonlightdancestatuekit",
  vegetablefield: "fieldgrass",
  "seat(wide": "seat(wide)",
  stand: "plainstand",
  "boo-in-thebox": "boo-in-the-box",
  musicmat: "musicmat(re)",
  "seat(widde)": "seat(wide)",
  wastebin: "garbagebin",
  slylight: "skylight",
  "seabedflowerseeds(purple)": "seabedflowerseeds",
  pokemoncenterrebuildkit: "wastelandpokemoncenterkit",
  cardboardbox: "cardboardboxes",
  flodingchair: "foldingchair",
  "aged-stonedwall": "aged-stonewall",
  stones: "stone",
  icicles: "icicle",
  seaglassfragment: "seaglassfragments",
  "patternedaged-stolewall": "patternedaged-stonewall",
  "statelywall(upperlower))": "statelywall(upperlower)",
  seashelllamp: "shelllamp",
};
log("Baking reference images into public/images (existing files are skipped)…");
const catalog = JSON.parse(await readFile("public/data/catalog.json", "utf8"));
const national = [
  ...new Set(
    catalog.pokemon.map((p) => p.nationalNumber).filter((n) => n != null),
  ),
];
const jobs = [
  ...national.map((n) => ({
    dest: `public/images/pokemon/${n}.png`,
    url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${n}.png`,
    kind: "artwork",
  })),
  ...national.map((n) => ({
    dest: `public/images/pokemon/sprites/${n}.png`,
    url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${n}.png`,
    kind: "sprite",
  })),
  ...[
    ...new Set(
      catalog.pokemon.flatMap((p) =>
        p.habitats.map((h) => h.image).filter(Boolean),
      ),
    ),
  ].map((url) => ({
    dest: `public/images/habitats/${url.split("/").pop()}`,
    url,
    kind: "habitat",
  })),
  ...catalog.items.map((item) => ({
    dest: `public/images/items/${item.id}.png`,
    url: `https://www.serebii.net/pokemonpokopia/items/${ITEM_IMAGE_FALLBACKS[item.id] || item.id}.png`,
    kind: "item",
  })),
  ...[
    ...new Set(
      catalog.pokemon.flatMap((p) =>
        p.specialties
          .map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ""))
          .filter(Boolean),
      ),
    ),
  ].map((id) => ({
    dest: `public/images/specialties/${id}.png`,
    url: `https://www.serebii.net/pokemonpokopia/pokedex/specialty/${id}.png`,
    kind: "specialty",
  })),
];

await mkdir("public/images/pokemon/sprites", { recursive: true });
await mkdir("public/images/habitats", { recursive: true });
await mkdir("public/images/items", { recursive: true });
await mkdir("public/images/specialties", { recursive: true });

const tally = {
  artwork: { ok: 0, skip: 0, fail: 0 },
  sprite: { ok: 0, skip: 0, fail: 0 },
  habitat: { ok: 0, skip: 0, fail: 0 },
  item: { ok: 0, skip: 0, fail: 0 },
  specialty: { ok: 0, skip: 0, fail: 0 },
};
const failed = [];
let done = 0;

async function fileHasBytes(dest) {
  try {
    return (await stat(dest)).size > 0;
  } catch {
    return false;
  }
}

async function download(job) {
  if (!force && (await fileHasBytes(job.dest))) {
    tally[job.kind].skip++;
    return;
  }
  try {
    await run(
      "curl",
      [
        "--fail",
        "-sSL",
        "--retry",
        "5",
        "--retry-delay",
        "2",
        "--max-time",
        "45",
        "-o",
        job.dest,
        job.url,
      ],
      { timeout: 60000 },
    );
    if (!(await fileHasBytes(job.dest))) throw Error("empty file");
    tally[job.kind].ok++;
  } catch (err) {
    tally[job.kind].fail++;
    failed.push({ dest: job.dest, url: job.url, kind: job.kind });
    try {
      await unlink(job.dest);
    } catch {}
    if (failed.length <= 12)
      console.error("miss", job.kind, job.url, err.stderr || err.message || err);
  }
}

let i = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (i < jobs.length) {
      const job = jobs[i++];
      await download(job);
      done++;
      if (done % 100 === 0) log(`baked ${done}/${jobs.length}`);
    }
  }),
);

if (failed.length) {
  const retry = failed.splice(0);
  log(`Retrying ${retry.length} missed files…`);
  for (const job of retry) {
    tally[job.kind].fail--;
    await download(job);
  }
}

const summary = {
  files: jobs.length,
  ...tally,
  failed: failed.length,
};
await writeFile(
  "public/images/manifest.json",
  JSON.stringify(
    {
      bakedAt: new Date().toISOString(),
      catalogVersion: catalog.version,
      summary,
      missing: failed,
    },
    null,
    2,
  ),
);
console.error(JSON.stringify(summary, null, 2));
const requiredFail = tally.artwork.fail + tally.habitat.fail;
if (requiredFail) {
  console.error(
    `Bake failed: ${tally.artwork.fail} artwork and ${tally.habitat.fail} habitat files missing.`,
  );
  process.exit(1);
}
if (tally.item.fail)
  console.warn(`${tally.item.fail} item icons were not downloaded.`);
if (tally.specialty.fail)
  console.warn(`${tally.specialty.fail} specialty icons were not downloaded.`);
