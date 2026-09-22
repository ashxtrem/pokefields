import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import sharp from "sharp";

const ROOT = resolve(import.meta.dirname, "..");
const MANIFEST_PATH = join(
  ROOT,
  "benchmarks/storage-recognition/manifest.json",
);
const CATALOG_PATH = join(ROOT, "public/data/catalog.json");
const ITEM_IMAGE_DIR = join(ROOT, "public/images/items");
const DEFAULT_OUTPUT_DIR = join(ROOT, ".artifacts/storage-recognition");
const SIDE = 64;
const REFERENCE_SCALES = [38, 42, 46, 50];
const SHIFTS = [-4, 0, 4];

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1]
    ? resolve(process.argv[index + 1])
    : fallback;
}

const inputDir = option("--input-dir", join(homedir(), "Downloads"));
const outputDir = option("--output-dir", DEFAULT_OUTPUT_DIR);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rate(hits, total) {
  return total === 0 ? 0 : hits / total;
}

function correlation(template, screenshot, shiftX, shiftY) {
  const templateSums = [0, 0, 0];
  const screenshotSums = [0, 0, 0];
  const templateSquares = [0, 0, 0];
  const screenshotSquares = [0, 0, 0];
  const products = [0, 0, 0];
  let count = 0;

  for (let y = 1; y < SIDE - 1; y += 1) {
    for (let x = 1; x < SIDE - 1; x += 1) {
      const templateX = x - shiftX;
      const templateY = y - shiftY;
      if (
        templateX < 0 ||
        templateX >= SIDE ||
        templateY < 0 ||
        templateY >= SIDE
      )
        continue;

      const templateIndex = (templateY * SIDE + templateX) * 4;
      if (template[templateIndex + 3] < 100) continue;

      const screenshotIndex = (y * SIDE + x) * 3;
      count += 1;
      for (let channel = 0; channel < 3; channel += 1) {
        const templateValue = template[templateIndex + channel];
        const screenshotValue = screenshot[screenshotIndex + channel];
        templateSums[channel] += templateValue;
        screenshotSums[channel] += screenshotValue;
        templateSquares[channel] += templateValue * templateValue;
        screenshotSquares[channel] += screenshotValue * screenshotValue;
        products[channel] += templateValue * screenshotValue;
      }
    }
  }

  if (count < 40) return -2;

  let score = 0;
  let usableChannels = 0;
  for (let channel = 0; channel < 3; channel += 1) {
    const numerator =
      products[channel] -
      (templateSums[channel] * screenshotSums[channel]) / count;
    const templateVariance =
      templateSquares[channel] - templateSums[channel] ** 2 / count;
    const screenshotVariance =
      screenshotSquares[channel] - screenshotSums[channel] ** 2 / count;
    if (templateVariance > 1 && screenshotVariance > 1) {
      score += numerator / Math.sqrt(templateVariance * screenshotVariance);
      usableChannels += 1;
    }
  }
  return usableChannels ? score / usableChannels : -2;
}

async function makeTarget(sourcePath, manifest, testCase) {
  const half = Math.floor(manifest.recognitionCropSize / 2);
  const { firstCenterX: x, firstCenterY: y } = testCase.grid;
  const crop = await sharp(sourcePath)
    .rotate(manifest.rotationDegrees)
    .extract({
      left: Math.round(x - half),
      top: Math.round(y - half),
      width: manifest.recognitionCropSize,
      height: manifest.recognitionCropSize,
    })
    .png()
    .toBuffer();
  const { data } = await sharp(crop)
    .resize(SIDE, SIDE)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { crop, pixels: data };
}

async function makeReference(imagePath, scale) {
  const before = Math.floor((SIDE - scale) / 2);
  const after = SIDE - scale - before;
  const { data } = await sharp(imagePath)
    .resize(scale, scale, { fit: "fill" })
    .extend({
      top: before,
      bottom: after,
      left: before,
      right: after,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

async function makeGridPreview(sourcePath, manifest, testCase) {
  const scale = 0.3;
  const upright = await sharp(sourcePath)
    .rotate(manifest.rotationDegrees)
    .resize(1200, 900)
    .jpeg({ quality: 86 })
    .toBuffer();
  let rectangles = "";
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      const x =
        (testCase.grid.firstCenterX +
          column * testCase.grid.stepX -
          manifest.gridCropSize / 2) *
        scale;
      const y =
        (testCase.grid.firstCenterY +
          row * testCase.grid.stepY -
          manifest.gridCropSize / 2) *
        scale;
      const occupied = row * 10 + column < testCase.expectedOccupiedSlots;
      rectangles += `<rect x="${x}" y="${y}" width="${manifest.gridCropSize * scale}" height="${manifest.gridCropSize * scale}" fill="none" stroke="${occupied ? "#ff315d" : "#2ecff0"}" stroke-width="3"/>`;
    }
  }
  const overlay = Buffer.from(
    `<svg width="1200" height="900" xmlns="http://www.w3.org/2000/svg">${rectangles}</svg>`,
  );
  return sharp(upright)
    .composite([{ input: overlay }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

function dataUri(mime, buffer) {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function renderHtml(results, casesForHtml) {
  const verdict = results.gate.pass ? "PASS" : "NO-GO";
  const cards = casesForHtml
    .map(
      ({ result, cropUri, previewUri }) => `
      <section class="case">
        <div class="case-title">
          <div><strong>${escapeHtml(result.truthName)}</strong><span>${escapeHtml(result.file)}</span></div>
          <b class="rank">Truth rank #${result.truthRank}</b>
        </div>
        <div class="images">
          <figure><img src="${cropUri}" alt="Selected slot crop"><figcaption>Selected slot crop</figcaption></figure>
          <figure class="grid"><img src="${previewUri}" alt="Grid registration"><figcaption>Calibrated 2 x 10 grid</figcaption></figure>
        </div>
        <div class="candidates">
          ${result.topCandidates
            .slice(0, 5)
            .map(
              (
                candidate,
                index,
              ) => `<article class="candidate ${candidate.id === result.truthId ? "truth" : ""}">
                <span>#${index + 1}</span><img src="${candidate.imageUri}" alt=""><div><strong>${escapeHtml(candidate.name)}</strong><small>${candidate.score.toFixed(3)}</small></div>
              </article>`,
            )
            .join("")}
        </div>
      </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Storage recognition benchmark</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#17231e;background:#edf2ed}*{box-sizing:border-box}body{margin:0;padding:32px}main{max-width:1100px;margin:auto}.hero,.case{background:#fff;border:1px solid #dbe5dc;border-radius:20px;box-shadow:0 10px 28px #173b2412}.hero{padding:28px;margin-bottom:20px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#53705e}.verdict{display:inline-block;margin:8px 0 12px;padding:7px 11px;border-radius:999px;background:${results.gate.pass ? "#d7f6df" : "#ffe1df"};color:${results.gate.pass ? "#17602f" : "#9a2626"};font-weight:900}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.metric{padding:13px;border-radius:12px;background:#f4f7f4}.metric b{display:block;font-size:22px}.metric span{font-size:12px;color:#637067}.reasons{margin:16px 0 0;padding-left:20px;color:#5d302e}.case{padding:22px;margin:18px 0}.case-title{display:flex;justify-content:space-between;gap:16px;align-items:center}.case-title strong{display:block;font-size:20px}.case-title span{font-size:12px;color:#69766e}.rank{background:#eef3ee;padding:7px 10px;border-radius:10px}.images{display:grid;grid-template-columns:220px 1fr;gap:14px;margin:16px 0}.images figure{margin:0}.images img{display:block;width:100%;border-radius:12px;border:1px solid #dbe5dc}.images figcaption{font-size:12px;color:#69766e;margin-top:5px}.candidates{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.candidate{position:relative;display:flex;gap:8px;align-items:center;padding:8px;border:1px solid #dbe5dc;border-radius:12px;min-width:0}.candidate.truth{border:2px solid #2b9b56;background:#effaf2}.candidate>span{position:absolute;top:5px;left:6px;font-size:10px;color:#758078}.candidate img{width:52px;height:52px;object-fit:contain}.candidate div{min-width:0}.candidate strong,.candidate small{display:block}.candidate strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.candidate small{color:#69766e}@media(max-width:760px){body{padding:14px}.metrics{grid-template-columns:1fr 1fr}.images{grid-template-columns:1fr}.images figure:first-child{max-width:220px}.candidates{grid-template-columns:1fr 1fr}.grid{overflow:auto}}
</style></head><body><main>
<section class="hero"><div class="eyebrow">RECOGNITION BENCHMARK MVP</div><div class="verdict">${verdict}</div><h1>Camera-photo item recognition</h1><p>${escapeHtml(results.summary)}</p><div class="metrics">
<div class="metric"><b>${results.metrics.labeledSlots}</b><span>Labeled slots</span></div>
<div class="metric"><b>${Math.round(results.metrics.top1Rate * 100)}%</b><span>Top-1 accuracy</span></div>
<div class="metric"><b>${Math.round(results.metrics.top3Rate * 100)}%</b><span>Top-3 accuracy</span></div>
<div class="metric"><b>${results.metrics.catalogItems}</b><span>Catalog candidates</span></div></div>
<ul class="reasons">${results.gate.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul></section>
${cards}</main></body></html>`;
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  await mkdir(outputDir, { recursive: true });

  const availableItems = [];
  for (const item of catalog.items) {
    const imagePath = join(ITEM_IMAGE_DIR, `${item.id}.png`);
    try {
      await access(imagePath, fsConstants.R_OK);
      availableItems.push({ id: item.id, name: item.name, imagePath });
    } catch {
      // The benchmark scores only items with a bundled reference image.
    }
  }

  const targets = [];
  for (const testCase of manifest.cases) {
    const sourcePath = join(inputDir, testCase.file);
    await access(sourcePath, fsConstants.R_OK);
    targets.push({
      testCase,
      sourcePath,
      ...(await makeTarget(sourcePath, manifest, testCase)),
    });
  }

  const scoresByCase = targets.map(() => []);
  for (const item of availableItems) {
    const references = [];
    for (const scale of REFERENCE_SCALES)
      references.push(await makeReference(item.imagePath, scale));
    targets.forEach((target, caseIndex) => {
      let best = -2;
      for (const reference of references) {
        for (const shiftX of SHIFTS) {
          for (const shiftY of SHIFTS) {
            best = Math.max(
              best,
              correlation(reference, target.pixels, shiftX, shiftY),
            );
          }
        }
      }
      scoresByCase[caseIndex].push({
        id: item.id,
        name: item.name,
        score: best,
        imagePath: item.imagePath,
      });
    });
  }

  const caseResults = [];
  const casesForHtml = [];
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const ranked = scoresByCase[index].sort((a, b) => b.score - a.score);
    const truthIndex = ranked.findIndex(
      (candidate) => candidate.id === target.testCase.truthId,
    );
    const truthItem = availableItems.find(
      (item) => item.id === target.testCase.truthId,
    );
    const topCandidates = await Promise.all(
      ranked.slice(0, 10).map(async (candidate) => ({
        id: candidate.id,
        name: candidate.name,
        score: candidate.score,
        imageUri: dataUri("image/png", await readFile(candidate.imagePath)),
      })),
    );
    const result = {
      file: target.testCase.file,
      truthId: target.testCase.truthId,
      truthName: truthItem?.name ?? target.testCase.truthId,
      truthRank: truthIndex + 1,
      expectedOccupiedSlots: target.testCase.expectedOccupiedSlots,
      topCandidates,
    };
    caseResults.push({
      ...result,
      topCandidates: topCandidates.map(
        ({ imageUri: _imageUri, ...candidate }) => candidate,
      ),
    });
    casesForHtml.push({
      result,
      cropUri: dataUri("image/png", target.crop),
      previewUri: dataUri(
        "image/jpeg",
        await makeGridPreview(target.sourcePath, manifest, target.testCase),
      ),
    });
  }

  const labeledSlots = caseResults.length;
  const top1Rate = rate(
    caseResults.filter((testCase) => testCase.truthRank <= 1).length,
    labeledSlots,
  );
  const top3Rate = rate(
    caseResults.filter((testCase) => testCase.truthRank <= 3).length,
    labeledSlots,
  );
  const top30Rate = rate(
    caseResults.filter((testCase) => testCase.truthRank <= 30).length,
    labeledSlots,
  );
  const reasons = [];
  if (labeledSlots < manifest.gate.minimumLabeledSlots) {
    reasons.push(
      `Only ${labeledSlots} independently labeled slots are available; the gate requires ${manifest.gate.minimumLabeledSlots}.`,
    );
  }
  if (top1Rate < manifest.gate.minimumTop1Rate) {
    reasons.push(
      `Top-1 accuracy is ${(top1Rate * 100).toFixed(1)}%; the gate requires ${(manifest.gate.minimumTop1Rate * 100).toFixed(0)}%.`,
    );
  }
  if (top3Rate < manifest.gate.minimumTop3Rate) {
    reasons.push(
      `Top-3 accuracy is ${(top3Rate * 100).toFixed(1)}%; the gate requires ${(manifest.gate.minimumTop3Rate * 100).toFixed(0)}%.`,
    );
  }

  const results = {
    generatedAt: new Date().toISOString(),
    benchmark: manifest.name,
    method: "Masked multi-scale RGB correlation baseline",
    inputDir,
    summary:
      "The calibrated grid isolates the storage slots, but the current recognizer is not accurate enough to ship or to justify building the full storage workflow.",
    metrics: {
      labeledSlots,
      expectedOccupiedSlots: manifest.cases.reduce(
        (sum, testCase) => sum + testCase.expectedOccupiedSlots,
        0,
      ),
      extractedGridSlots: manifest.cases.length * 20,
      catalogItems: availableItems.length,
      top1Rate,
      top3Rate,
      top30Rate,
    },
    gate: { pass: reasons.length === 0, thresholds: manifest.gate, reasons },
    cases: caseResults,
  };

  const jsonPath = join(outputDir, "results.json");
  const htmlPath = join(outputDir, "report.html");
  await writeFile(jsonPath, `${JSON.stringify(results, null, 2)}\n`);
  await writeFile(htmlPath, renderHtml(results, casesForHtml));
  console.log(
    JSON.stringify(
      {
        verdict: results.gate.pass ? "PASS" : "NO-GO",
        jsonPath,
        htmlPath,
        metrics: results.metrics,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
