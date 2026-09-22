// Precomputes and versions the Storage Locator recognition reference index — the color/shape
// descriptor and ORB keypoints for every catalog item with baked artwork — so the client never
// rebuilds ~1,765 reference descriptors per scan (see docs/storage-locator-feature-master-prompt.md,
// "Precompute and version catalog color/shape and ORB reference features at build time").
//
// Run after scripts/bake-images.mjs (wired into `npm run build`) and before `vite build`, since
// the output is fetched by the app at public/data/storage-reference-index.v<N>.json.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import cvModule from "@techstark/opencv-js";
import { referenceDescriptor, referenceOrbDescriptor } from "./lib/node-image-adapter.mjs";

// Node scripts can't import a .ts file directly (no ts-node/tsx in this repo — see the plan's
// architecture notes on keeping the shared recognition core as plain .mjs for exactly this
// reason). This literal must match src/storage/constants.ts's RECOGNITION_INDEX_VERSION;
// tests/storage-recognition.test.ts asserts they stay in sync.
const RECOGNITION_INDEX_VERSION = 1;

const cv = await cvModule;
const ROOT = resolve(import.meta.dirname, "..");
const CATALOG_PATH = join(ROOT, "public/data/catalog.json");
const ITEM_IMAGE_DIR = join(ROOT, "public/images/items");
const OUTPUT_PATH = join(
  ROOT,
  `public/data/storage-reference-index.v${RECOGNITION_INDEX_VERSION}.json`,
);

function toBase64(uint8) {
  return Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength).toString("base64");
}

async function main() {
  const startedAt = performance.now();
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const items = [];
  const missingReferenceIds = [];

  for (const item of catalog.items) {
    const imagePath = join(ITEM_IMAGE_DIR, `${item.id}.png`);
    if (!existsSync(imagePath)) {
      missingReferenceIds.push(item.id);
      continue;
    }
    const descriptor = await referenceDescriptor(imagePath);
    const orb = await referenceOrbDescriptor(cv, imagePath);
    items.push({
      id: item.id,
      histogramB64: toBase64(new Uint8Array(descriptor.histogram.buffer)),
      shapeB64: toBase64(descriptor.shape),
      aspect: descriptor.aspect,
      orbRows: orb.rows,
      orbDataB64: orb.rows ? toBase64(new Uint8Array(orb.data)) : "",
    });
    orb.delete();
  }

  const output = {
    version: RECOGNITION_INDEX_VERSION,
    catalogVersion: catalog.version,
    builtAt: new Date().toISOString(),
    items,
    missingReferenceIds,
  };

  await mkdir(join(ROOT, "public/data"), { recursive: true });
  const json = JSON.stringify(output);
  await writeFile(OUTPUT_PATH, json);

  const elapsedMs = performance.now() - startedAt;
  console.log(
    JSON.stringify(
      {
        outputPath: OUTPUT_PATH,
        itemCount: items.length,
        missingReferenceCount: missingReferenceIds.length,
        fileBytes: Buffer.byteLength(json),
        fileMB: (Buffer.byteLength(json) / (1024 * 1024)).toFixed(2),
        elapsedMs: Math.round(elapsedMs),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
