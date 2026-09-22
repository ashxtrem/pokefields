import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import cvModule from "@techstark/opencv-js";
import sharp from "sharp";
import { slotBounds } from "../src/storage/recognition/core/grid.mjs";
import { targetDescriptor } from "../src/storage/recognition/core/foreground.mjs";
import { buildMedianBackground } from "../src/storage/recognition/core/foreground.mjs";
import { rankCandidates } from "../src/storage/recognition/core/retrieval.mjs";
import { createLshBuckets, insertIntoLshBuckets } from "../src/storage/recognition/core/lsh.mjs";
import {
  extractSlotRgb,
  referenceDescriptor,
  referenceOrbDescriptor,
  targetOrbDescriptor,
} from "./lib/node-image-adapter.mjs";

const cv = await cvModule;
const ROOT = resolve(import.meta.dirname, "..");
const MANIFEST_PATH = join(
  ROOT,
  "benchmarks/storage-recognition/native-switch-manifest.json",
);
const CATALOG_PATH = join(ROOT, "public/data/catalog.json");
const ITEM_IMAGE_DIR = join(ROOT, "public/images/items");
const DEFAULT_INPUT_DIR = join(ROOT, "docs/research/storage-samples");
const DEFAULT_OUTPUT_DIR = join(ROOT, ".artifacts/storage-recognition-native");

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1]
    ? resolve(process.argv[index + 1])
    : fallback;
}

const inputDir = option("--input-dir", DEFAULT_INPUT_DIR);
const outputDir = option("--output-dir", DEFAULT_OUTPUT_DIR);

function rate(hits, total) {
  return total ? hits / total : 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function dataUri(mime, buffer) {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function sha256(filePath) {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

async function validateInputs(manifest) {
  const allFiles = [
    ...manifest.pages.map((page) => page.file),
    ...manifest.duplicates.map((duplicate) => duplicate.file),
  ];
  for (const file of allFiles) {
    const filePath = join(inputDir, file);
    await access(filePath, fsConstants.R_OK);
    const metadata = await sharp(filePath).metadata();
    if (
      metadata.width !== manifest.input.width ||
      metadata.height !== manifest.input.height
    ) {
      throw new Error(
        `${file} is ${metadata.width}x${metadata.height}; expected ${manifest.input.width}x${manifest.input.height}`,
      );
    }
  }
  for (const duplicate of manifest.duplicates) {
    const [duplicateHash, sourceHash] = await Promise.all([
      sha256(join(inputDir, duplicate.file)),
      sha256(join(inputDir, duplicate.sameAs)),
    ]);
    if (duplicateHash !== sourceHash)
      throw new Error(
        `${duplicate.file} is declared as a duplicate of ${duplicate.sameAs}, but their hashes differ`,
      );
  }
}

function renderHtml(results, cards) {
  const cardHtml = cards
    .map(
      ({ result, cropUri }) => `<section class="case">
  <header><div><strong>${escapeHtml(result.truthName)}</strong><small>${escapeHtml(result.file)} · slot ${result.slot}</small></div><b>#${result.truthRank ?? "miss"}</b></header>
  <div class="row"><figure><img src="${cropUri}" alt="Screenshot slot crop"><figcaption>Screenshot crop</figcaption></figure>
    <div class="candidates">${result.topCandidates
      .map(
        (candidate, index) =>
          `<article class="${candidate.id === result.truthId ? "truth" : ""}"><span>#${index + 1}</span><img src="${candidate.imageUri}" alt=""><div><strong>${escapeHtml(candidate.name)}</strong><small>score ${candidate.score.toFixed(2)}</small></div></article>`,
      )
      .join("")}</div></div>
</section>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Native storage recognition benchmark</title><style>
:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#17231e;background:#edf2ed}*{box-sizing:border-box}body{margin:0;padding:28px}main{max-width:1180px;margin:auto}.hero,.case{background:white;border:1px solid #dbe5dc;border-radius:18px;box-shadow:0 10px 28px #173b2412}.hero{padding:26px;margin-bottom:18px}.verdict{display:inline-block;padding:7px 11px;border-radius:999px;background:${results.gate.pass ? "#d7f6df" : "#ffe1df"};color:${results.gate.pass ? "#17602f" : "#9a2626"};font-weight:900}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.metric{padding:12px;border-radius:12px;background:#f4f7f4}.metric b,.metric span{display:block}.metric b{font-size:22px}.metric span{font-size:12px;color:#637067}.notice{color:#6b5032}.case{padding:18px;margin:14px 0}.case header{display:flex;justify-content:space-between;align-items:center}.case header strong,.case header small{display:block}.case header small{color:#69766e;margin-top:3px}.case header>b{background:#eef3ee;padding:7px 10px;border-radius:10px}.row{display:grid;grid-template-columns:112px 1fr;gap:14px;margin-top:12px}figure{margin:0}figure img{width:100%;border:1px solid #dbe5dc;border-radius:12px}figcaption{font-size:11px;color:#69766e}.candidates{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.candidates article{display:flex;align-items:center;gap:7px;padding:7px;border:1px solid #dbe5dc;border-radius:11px;min-width:0}.candidates article.truth{border:2px solid #2b9b56;background:#effaf2}.candidates article>span{font-size:10px;color:#758078}.candidates img{width:48px;height:48px;object-fit:contain}.candidates div{min-width:0}.candidates strong,.candidates small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.candidates strong{font-size:11px}.candidates small{font-size:10px;color:#69766e}@media(max-width:780px){body{padding:12px}.metrics{grid-template-columns:1fr 1fr}.row{grid-template-columns:1fr}.row figure{max-width:112px}.candidates{grid-template-columns:1fr 1fr}}
</style></head><body><main><section class="hero"><div class="verdict">${results.gate.pass ? "PASS" : "NO-GO"}</div><h1>Native Switch screenshot recognition</h1><p>${escapeHtml(results.summary)}</p><div class="metrics"><div class="metric"><b>${results.metrics.labeledSlots}</b><span>Labeled slots</span></div><div class="metric"><b>${(results.metrics.top1Rate * 100).toFixed(1)}%</b><span>Top-1</span></div><div class="metric"><b>${(results.metrics.top3Rate * 100).toFixed(1)}%</b><span>Top-3</span></div><div class="metric"><b>${results.metrics.catalogItems}</b><span>Catalog images</span></div><div class="metric"><b>${(results.timings.totalMs / 1000).toFixed(1)}s</b><span>Total runtime</span></div></div><p class="notice">Unknown-item rejection is not measured by this dataset. Low-confidence results must remain reviewable until that gate is calibrated.</p></section>${cardHtml}</main></body></html>`;
}

async function main() {
  const startedAt = performance.now();
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  await mkdir(outputDir, { recursive: true });
  await validateInputs(manifest);

  const grid = manifest.input.grid;
  const slotPixels = new Map();
  const allOccupiedSlots = [];
  for (const page of manifest.pages) {
    const imagePath = join(inputDir, page.file);
    for (let slot = 1; slot <= page.occupiedSlots; slot += 1) {
      const { pixels } = await extractSlotRgb(imagePath, slotBounds(grid, slot));
      slotPixels.set(`${page.file}:${slot}`, pixels);
      allOccupiedSlots.push(pixels);
    }
  }

  const background = buildMedianBackground(
    allOccupiedSlots,
    grid.cropWidth,
    grid.cropHeight,
    3,
  );

  const targets = [];
  for (const annotation of manifest.annotations) {
    const imagePath = join(inputDir, annotation.file);
    const bounds = slotBounds(grid, annotation.slot);
    const pixels = slotPixels.get(`${annotation.file}:${annotation.slot}`);
    const descriptor = targetDescriptor(pixels, background, grid.cropWidth, grid.cropHeight, 3);
    if (!descriptor)
      throw new Error(
        `No foreground object found in a target slot (${annotation.file} slot ${annotation.slot})`,
      );
    targets.push({
      ...annotation,
      imagePath,
      bounds,
      descriptor,
      orb: await targetOrbDescriptor(cv, imagePath, bounds),
    });
  }

  const referenceStartedAt = performance.now();
  const references = [];
  const lshBuckets = createLshBuckets();
  for (const item of catalog.items) {
    const imagePath = join(ITEM_IMAGE_DIR, `${item.id}.png`);
    if (!existsSync(imagePath)) continue;
    const descriptor = await referenceDescriptor(imagePath);
    const orb = await referenceOrbDescriptor(cv, imagePath);
    const referenceIndex = references.length;
    insertIntoLshBuckets(lshBuckets, orb, referenceIndex);
    references.push({
      id: item.id,
      name: item.name,
      imagePath,
      descriptor,
      orb,
    });
  }
  const referenceMs = performance.now() - referenceStartedAt;

  const scoringStartedAt = performance.now();
  const caseResults = [];
  const cards = [];
  for (const target of targets) {
    const ranked = rankCandidates({
      cv,
      target,
      references,
      lshBuckets,
      retrieval: manifest.retrieval,
    });
    const truthIndex = ranked.findIndex((candidate) => candidate.id === target.truthId);
    const topCandidates = [];
    for (const candidate of ranked.slice(0, 5)) {
      topCandidates.push({
        ...candidate,
        name: references[candidate.referenceIndex].name,
        imagePath: references[candidate.referenceIndex].imagePath,
        imageUri: dataUri(
          "image/png",
          await readFile(references[candidate.referenceIndex].imagePath),
        ),
      });
    }
    const truth = references.find((reference) => reference.id === target.truthId);
    if (!truth) throw new Error(`Missing truth item ${target.truthId}`);
    const result = {
      file: target.file,
      slot: target.slot,
      truthId: target.truthId,
      truthName: truth.name,
      truthRank: truthIndex >= 0 ? truthIndex + 1 : null,
      topScore: ranked[0]?.score ?? null,
      topTwoMargin: ranked.length >= 2 ? ranked[0].score - ranked[1].score : null,
      topCandidates,
    };
    caseResults.push({
      ...result,
      topCandidates: topCandidates.map(
        ({ imagePath: _imagePath, imageUri: _imageUri, ...candidate }) => candidate,
      ),
    });
    cards.push({
      result,
      cropUri: dataUri(
        "image/png",
        await sharp(target.imagePath).extract(target.bounds).png().toBuffer(),
      ),
    });
    console.log(
      `${target.file} slot ${target.slot}: ${target.truthId} ranked ${result.truthRank ?? "outside shortlist"}`,
    );
  }
  const scoringMs = performance.now() - scoringStartedAt;

  const labeledSlots = caseResults.length;
  const top1Rate = rate(
    caseResults.filter((result) => result.truthRank === 1).length,
    labeledSlots,
  );
  const top3Rate = rate(
    caseResults.filter((result) => result.truthRank !== null && result.truthRank <= 3).length,
    labeledSlots,
  );
  const reasons = [];
  if (labeledSlots < manifest.gate.minimumLabeledSlots)
    reasons.push(
      `Only ${labeledSlots} labels are available; ${manifest.gate.minimumLabeledSlots} are required.`,
    );
  if (top1Rate < manifest.gate.minimumTop1Rate)
    reasons.push(
      `Top-1 is ${(top1Rate * 100).toFixed(1)}%; ${(manifest.gate.minimumTop1Rate * 100).toFixed(0)}% is required.`,
    );
  if (top3Rate < manifest.gate.minimumTop3Rate)
    reasons.push(
      `Top-3 is ${(top3Rate * 100).toFixed(1)}%; ${(manifest.gate.minimumTop3Rate * 100).toFixed(0)}% is required.`,
    );

  const totalMs = performance.now() - startedAt;
  const results = {
    generatedAt: new Date().toISOString(),
    benchmark: manifest.name,
    method:
      "Median-background slot isolation, HSV/shape retrieval, ORB LSH retrieval, and exact ORB reranking",
    inputDir,
    summary:
      reasons.length === 0
        ? "The native-screenshot recognizer clears the MVP known-item gate."
        : "The native-screenshot recognizer does not clear the MVP known-item gate.",
    metrics: {
      uniquePages: manifest.pages.length,
      duplicatePagesExcluded: manifest.duplicates.length,
      occupiedSlots: manifest.pages.reduce((sum, page) => sum + page.occupiedSlots, 0),
      labeledSlots,
      catalogItems: references.length,
      top1Rate,
      top3Rate,
      unknownRejection: "not evaluated",
    },
    timings: { referenceMs, scoringMs, totalMs },
    gate: {
      pass: reasons.length === 0,
      thresholds: manifest.gate,
      reasons,
    },
    cases: caseResults,
  };

  const jsonPath = join(outputDir, "results.json");
  const htmlPath = join(outputDir, "report.html");
  await writeFile(jsonPath, `${JSON.stringify(results, null, 2)}\n`);
  await writeFile(htmlPath, renderHtml(results, cards));
  for (const target of targets) target.orb.delete();
  for (const reference of references) reference.orb.delete();
  console.log(
    JSON.stringify(
      {
        verdict: results.gate.pass ? "PASS" : "NO-GO",
        metrics: results.metrics,
        timings: results.timings,
        jsonPath,
        htmlPath,
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
