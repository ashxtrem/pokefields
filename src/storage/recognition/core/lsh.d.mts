export type LshBuckets = number[][][];

export function lshKeys(descriptor: unknown): number[][];
export function createLshBuckets(): LshBuckets;
export function insertIntoLshBuckets(
  buckets: LshBuckets,
  orbDescriptor: unknown,
  referenceIndex: number,
): void;
export function voteLshBuckets(
  buckets: LshBuckets,
  targetOrbDescriptor: unknown,
  referenceCount: number,
): Float32Array;
