import type { Habitat, Item } from "../catalog/types";
import { parseRequirement, resolveItem } from "../dex/glossary";
import type { NormalizedRequirement, RequirementAllocation } from "./types";

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

export function shoppingRequirements(requirements: NormalizedRequirement[]) {
  return requirements.filter((req) => req.kind === "item" && req.quantity);
}

export function buildAllocations(
  requirements: NormalizedRequirement[],
  copies: number,
  previous: RequirementAllocation[] = [],
): RequirementAllocation[] {
  const prev = new Map(previous.map((row) => [row.requirementId, row]));
  return shoppingRequirements(requirements).map((req) => {
    const required = (req.quantity || 0) * copies;
    const old = prev.get(req.id);
    const gathered = old ? Math.min(Math.max(0, old.gathered), required) : 0;
    return {
      requirementId: req.id,
      signature: req.signature,
      raw: req.raw,
      label: req.label,
      kind: req.kind,
      required,
      gathered,
    };
  });
}

export function allocationItemKey(row: RequirementAllocation) {
  return row.kind === "item"
    ? `item:${row.signature.split(":")[1]}`
    : row.requirementId;
}
