import type { Habitat, Item } from "../catalog/types";
import { parseRequirement, resolveItem } from "../dex/glossary";
import type { NormalizedRequirement } from "./types";

export function requirementSignature(
  raw: string,
  kind: NormalizedRequirement["kind"],
  itemId: string | null,
  quantity: number | null,
) {
  return `${kind}:${itemId || raw}:${quantity ?? "na"}`;
}

export function normalizeRequirements(
  habitat: Habitat,
  items: Item[],
): NormalizedRequirement[] {
  return habitat.requirements.map((raw, index) => {
    const parsed = parseRequirement(raw);
    const item = resolveItem(parsed.name, items);
    const quantity = parsed.quantity ? Number(parsed.quantity) : null;
    const trackedItem =
      parsed.kind === "item" &&
      items.some((entry) => entry.id === item.id) &&
      Number.isSafeInteger(quantity) &&
      quantity! > 0;
    const kind: NormalizedRequirement["kind"] = trackedItem
      ? "item"
      : parsed.kind === "condition"
        ? "condition"
        : "review";
    const id = `req:${index}:${kind}:${trackedItem ? item.id : parsed.name}`;
    return {
      id,
      signature: requirementSignature(
        raw,
        kind,
        trackedItem ? item.id : null,
        quantity,
      ),
      raw,
      label: trackedItem ? item.name : raw.replace(/\s+/g, " ").trim(),
      kind,
      itemId: trackedItem ? item.id : null,
      quantity: trackedItem ? quantity : null,
    };
  });
}

