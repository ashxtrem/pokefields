// ORB keypoint descriptor + matching, extracted verbatim from
// scripts/benchmark-native-storage-recognition.mjs's `makeOrbDescriptor`/`matchOrb`. `cv` (the
// @techstark/opencv-js module) is now an explicit parameter instead of a module-level top-level
// await, since Node and the browser worker each resolve/load it differently.

import { orbConstructorArgs, ORB_LOWE_RATIO, ORB_MAX_HAMMING_DISTANCE } from "./constants.mjs";

export function makeOrbDescriptor(cv, mat) {
  const orb = new cv.ORB(...orbConstructorArgs(cv));
  const keypoints = new cv.KeyPointVector();
  const descriptor = new cv.Mat();
  const mask = new cv.Mat();
  orb.detectAndCompute(mat, mask, keypoints, descriptor);
  orb.delete();
  keypoints.delete();
  mask.delete();
  mat.delete();
  return descriptor;
}

export function matchOrb(cv, target, reference) {
  if (!target.rows || !reference.rows)
    return { orbScore: 0, goodMatches: 0, averageDistance: null };
  const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
  const matches = new cv.DMatchVectorVector();
  matcher.knnMatch(target, reference, matches, 2);
  let goodMatches = 0;
  let distanceTotal = 0;
  for (let index = 0; index < matches.size(); index += 1) {
    const pair = matches.get(index);
    if (pair.size() >= 2) {
      const best = pair.get(0);
      const second = pair.get(1);
      if (best.distance < ORB_LOWE_RATIO * second.distance) {
        goodMatches += 1;
        distanceTotal += best.distance;
      }
    }
    pair.delete();
  }
  matcher.delete();
  matches.delete();
  const averageDistance = goodMatches ? distanceTotal / goodMatches : null;
  return {
    goodMatches,
    averageDistance,
    orbScore: goodMatches
      ? goodMatches * (1 - averageDistance / ORB_MAX_HAMMING_DISTANCE)
      : 0,
  };
}
