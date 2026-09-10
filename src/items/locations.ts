import type { Item } from "../catalog/types";
import { buildItemIndex, resolveExactItemId } from "../crafting/identity";

const LOCATION_SUFFIX = /\s*\((?:Build Kit|Natural)\)\s*$/i;

export function locationTargetId(
  line: string,
  items: Item[] | ReturnType<typeof buildItemIndex>,
): string | null {
  const index = Array.isArray(items) ? buildItemIndex(items) : items;
  const stripped = line.replace(LOCATION_SUFFIX, "").trim();
  if (!stripped) return null;
  return (
    resolveExactItemId(stripped, index) || resolveExactItemId(line.trim(), index)
  );
}
