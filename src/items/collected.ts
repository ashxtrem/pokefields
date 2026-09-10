export function isCollected(ids: Iterable<string> | undefined, itemId: string) {
  return Boolean(ids && [...ids].includes(itemId));
}

export function toggleCollected(
  ids: string[] | undefined,
  itemId: string,
): string[] {
  const next = new Set(ids || []);
  if (next.has(itemId)) next.delete(itemId);
  else next.add(itemId);
  return [...next];
}

export function visibleCollectedCount(
  collectedIds: string[] | undefined,
  itemIds: Iterable<string>,
) {
  const known = new Set(itemIds);
  return (collectedIds || []).filter((id) => known.has(id)).length;
}

export function unavailableCollected(
  collectedIds: string[] | undefined,
  itemIds: Iterable<string>,
) {
  const known = new Set(itemIds);
  return (collectedIds || []).filter((id) => !known.has(id));
}
