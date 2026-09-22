// ORB locality-sensitive-hash bucketing, extracted verbatim from
// scripts/benchmark-native-storage-recognition.mjs (`lshKeys` plus the bucket build/vote logic
// inlined in its `main()`).

import { LSH_BYTES, LSH_BUCKET_SIZE } from "./constants.mjs";

export function lshKeys(descriptor) {
  const bytes = Uint8Array.from(descriptor.data);
  const keys = [];
  for (let row = 0; row < descriptor.rows; row += 1) {
    const offset = row * 32;
    keys.push(
      LSH_BYTES.map(
        ([first, second]) =>
          (bytes[offset + first] << 4) | (bytes[offset + second] >> 4),
      ),
    );
  }
  return keys;
}

export function createLshBuckets() {
  return LSH_BYTES.map(() => Array.from({ length: LSH_BUCKET_SIZE }, () => []));
}

export function insertIntoLshBuckets(buckets, orbDescriptor, referenceIndex) {
  for (const keys of lshKeys(orbDescriptor)) {
    for (let table = 0; table < keys.length; table += 1)
      buckets[table][keys[table]].push(referenceIndex);
  }
}

/** Vote counts per reference index, one vote per table that shares a bucket (deduped per table). */
export function voteLshBuckets(buckets, targetOrbDescriptor, referenceCount) {
  const votes = new Float32Array(referenceCount);
  for (const keys of lshKeys(targetOrbDescriptor)) {
    for (let table = 0; table < keys.length; table += 1) {
      const seen = new Set();
      for (const referenceIndex of buckets[table][keys[table]]) {
        if (!seen.has(referenceIndex)) {
          votes[referenceIndex] += 1;
          seen.add(referenceIndex);
        }
      }
    }
  }
  return votes;
}
