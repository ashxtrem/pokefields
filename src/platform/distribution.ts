export type Distribution = "web" | "android";

export function parseDistribution(value: unknown): Distribution {
  if (value === "web" || value === "android") return value;
  throw new Error(
    `Unsupported VITE_DISTRIBUTION ${JSON.stringify(value)}. Expected "web" or "android".`,
  );
}

export const distribution = parseDistribution(
  import.meta.env.VITE_DISTRIBUTION,
);

export function isWebDistribution(): boolean {
  return distribution === "web";
}

export function isAndroidDistribution(): boolean {
  return distribution === "android";
}
