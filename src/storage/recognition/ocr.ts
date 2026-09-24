import { createWorker, type Worker } from "tesseract.js";
import { normalizeItemName } from "../types";

/**
 * OCR is not the item recognizer (per the master prompt) — icon matching is. This wrapper exists
 * only to read the *text* the game shows for whichever item is currently selected, as an
 * independent tie-breaker signal, and only when it uniquely resolves to one catalog name. One
 * worker is created lazily and reused for a whole multi-page scan; call terminateOcrWorker() when
 * the scan flow closes.
 */

let workerPromise: Promise<Worker> | null = null;

const androidOcrOptions =
  import.meta.env.VITE_DISTRIBUTION === "android"
    ? {
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract/core",
        langPath: "/tesseract/lang",
        gzip: false,
      }
    : undefined;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) workerPromise = createWorker("eng", 1, androidOcrOptions);
  return workerPromise;
}

export async function recognizeText(source: Blob | ImageBitmap): Promise<string | null> {
  try {
    const worker = await getWorker();
    let input: Blob = source as Blob;
    if (!(source instanceof Blob)) {
      const canvas = new OffscreenCanvas(source.width, source.height);
      const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(source, 0, 0);
      input = await canvas.convertToBlob();
    }
    const { data } = await worker.recognize(input);
    const text = data.text.trim();
    return text || null;
  } catch {
    return null;
  }
}

/** Only a useful signal when the text resolves to exactly one catalog item's normalized name. */
export function resolveOcrToUniqueCatalogItem(
  text: string,
  catalogItems: Array<{ id: string; name: string }>,
): string | null {
  const normalized = normalizeItemName(text);
  if (!normalized) return null;
  const matches = catalogItems.filter((item) => normalizeItemName(item.name) === normalized);
  return matches.length === 1 ? matches[0]!.id : null;
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
}
