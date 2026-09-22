export interface OrbMatchResult {
  goodMatches: number;
  averageDistance: number | null;
  orbScore: number;
}

// `cv` and Mat/descriptor types come from @techstark/opencv-js, which ships no first-party
// TypeScript types; `unknown` keeps this module's boundary honest without a fake shape.
export function makeOrbDescriptor(cv: unknown, mat: unknown): unknown;
export function matchOrb(cv: unknown, target: unknown, reference: unknown): OrbMatchResult;
