import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, ".android-build/tesseract");

const files = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  [
    "node_modules/tesseract.js-core/tesseract-core.wasm.js",
    "core/tesseract-core.wasm.js",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-simd.wasm.js",
    "core/tesseract-core-simd.wasm.js",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
    "core/tesseract-core-lstm.wasm.js",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
    "core/tesseract-core-simd-lstm.wasm.js",
  ],
];

await rm(OUTPUT, { recursive: true, force: true });
for (const [source, destination] of files) {
  const outputPath = join(OUTPUT, destination);
  await mkdir(dirname(outputPath), { recursive: true });
  await copyFile(join(ROOT, source), outputPath);
}
const trainedDataPath = join(OUTPUT, "lang/eng.traineddata");
await mkdir(dirname(trainedDataPath), { recursive: true });
await writeFile(
  trainedDataPath,
  gunzipSync(
    await readFile(
      join(
        ROOT,
        "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
      ),
    ),
  ),
);

console.log(
  JSON.stringify(
    {
      output: ".android-build/tesseract",
      files: [
        ...files.map(([, destination]) => destination),
        "lang/eng.traineddata",
      ],
    },
    null,
    2,
  ),
);
