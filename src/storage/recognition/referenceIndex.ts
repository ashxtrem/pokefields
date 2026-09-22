import { createLshBuckets, insertIntoLshBuckets } from "./core/lsh.mjs";
import type { Descriptor } from "./core/descriptor.mjs";

/**
 * The JSON files scripts/build-storage-references.mjs bakes at build time from
 * public/images/items/*.png, fetched once per scan session (src/storage/constants.ts's
 * RECOGNITION_INDEX_URL) and reused across all 1 or 3 pages of a scan — see the master prompt's
 * "Precompute and version catalog descriptors... Load the precomputed index once per scan session."
 *
 * The full descriptor set is 40+ MiB base64-encoded, over Cloudflare Pages' 25 MiB per-file limit,
 * so RECOGNITION_INDEX_URL now points at a small manifest listing one or more "part" files that
 * together hold every item — see the build script's header comment for the packaging rationale.
 */
export interface ReferenceIndexItem {
  id: string;
  histogramB64: string;
  shapeB64: string;
  aspect: number;
  orbRows: number;
  orbDataB64: string;
}

export interface ReferenceIndexManifest {
  version: number;
  catalogVersion: string;
  builtAt: string;
  /** Filenames, relative to the manifest's own URL, each resolving to a ReferenceIndexPart. */
  parts: string[];
  /** Catalog ids with no usable baked artwork — excluded from matching, still selectable manually. */
  missingReferenceIds: string[];
}

interface ReferenceIndexPart {
  items: ReferenceIndexItem[];
}

export interface LoadedReference {
  id: string;
  descriptor: Descriptor;
  orb: unknown;
}

export interface LoadedReferenceIndex {
  references: LoadedReference[];
  lshBuckets: ReturnType<typeof createLshBuckets>;
  catalogVersion: string;
  missingReferenceIds: string[];
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** `cv` must already be loaded — ORB descriptors are reconstructed as real cv.Mat objects so the
 * shared core/retrieval.mjs's exact-ORB reranking (matchOrb) works identically to the Node build. */
export async function loadReferenceIndex(cv: any, url: string): Promise<LoadedReferenceIndex> {
  const manifestResponse = await fetch(url);
  if (!manifestResponse.ok) throw new Error("Recognition reference data could not be loaded.");
  const manifest = (await manifestResponse.json()) as ReferenceIndexManifest;

  const partResponses = await Promise.all(
    manifest.parts.map((part) => fetch(new URL(part, manifestResponse.url))),
  );
  if (partResponses.some((partResponse) => !partResponse.ok))
    throw new Error("Recognition reference data could not be loaded.");
  const parts = (await Promise.all(partResponses.map((partResponse) => partResponse.json()))) as ReferenceIndexPart[];
  const items = parts.flatMap((part) => part.items);

  const references: LoadedReference[] = items.map((item) => {
    const histogramBytes = base64ToUint8Array(item.histogramB64);
    const histogram = new Float32Array(
      histogramBytes.buffer,
      histogramBytes.byteOffset,
      histogramBytes.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );
    const shape = base64ToUint8Array(item.shapeB64);
    const orbBytes = base64ToUint8Array(item.orbDataB64);
    const orb = item.orbRows > 0 ? cv.matFromArray(item.orbRows, 32, cv.CV_8UC1, orbBytes) : new cv.Mat();
    return { id: item.id, descriptor: { histogram, shape, aspect: item.aspect }, orb };
  });

  const lshBuckets = createLshBuckets();
  references.forEach((reference, index) => {
    if ((reference.orb as { rows: number }).rows > 0) insertIntoLshBuckets(lshBuckets, reference.orb, index);
  });

  return {
    references,
    lshBuckets,
    catalogVersion: manifest.catalogVersion,
    missingReferenceIds: manifest.missingReferenceIds,
  };
}
