export interface NativeGrid {
  width: number;
  height: number;
  columns: number;
  rows: number;
  firstCenterX: number;
  firstCenterY: number;
  stepX: number;
  stepY: number;
  cropWidth: number;
  cropHeight: number;
}
export const NATIVE_GRID: NativeGrid;

export interface RetrievalConfig {
  histogramCandidates: number;
  orbCandidates: number;
  histogramWeight: number;
}
export const RETRIEVAL: RetrievalConfig;

export interface GateThresholds {
  minimumLabeledSlots: number;
  minimumTop1Rate: number;
  minimumTop3Rate: number;
}
export const GATE: GateThresholds;

export const DESCRIPTOR_SIDE: number;
export const ORB_SIDE: number;
export const LSH_BYTES: number[][];
export const LSH_BUCKET_SIZE: number;

export const FOREGROUND_DIFF_THRESHOLD: number;
export const FOREGROUND_SCAN_MAX_Y: number;
export const FOREGROUND_SCAN_MARGIN_X: number;
export const FOREGROUND_MIN_COMPONENT_SIZE: number;
export const FOREGROUND_CENTER_Y_BIAS: number;
export const FOREGROUND_CENTRALITY_FALLOFF: number;

export interface DescriptorWeights {
  histogram: number;
  shape: number;
  aspect: number;
}
export const DESCRIPTOR_WEIGHTS: DescriptorWeights;

export const REFERENCE_ALPHA_THRESHOLD: number;
export const ORB_LOWE_RATIO: number;
export const ORB_MAX_HAMMING_DISTANCE: number;

export interface ReferenceOrbPrep {
  resize: number;
  pad: number;
  background: string;
}
export const REFERENCE_ORB_PREP: ReferenceOrbPrep;

export function orbConstructorArgs(cv: unknown): unknown[];
