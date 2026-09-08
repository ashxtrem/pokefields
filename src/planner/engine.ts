import type { Catalog, Item, Pokemon } from "../catalog/types";
import type { Home, Plan, PlannerInput, Plot } from "./types";
export function validPlot(p: Plot) {
  return (
    Number.isInteger(p.width) &&
    Number.isInteger(p.depth) &&
    p.width >= 1 &&
    p.depth >= 1 &&
    p.width <= 200 &&
    p.depth <= 200
  );
}
export function canPlace(
  home: Home,
  homes: Home[],
  plot: Plot,
  catalog: Catalog,
) {
  const k = catalog.kits.find((k) => k.id === home.kitId);
  if (
    !k ||
    !Number.isInteger(home.x) ||
    !Number.isInteger(home.y) ||
    home.x < 0 ||
    home.y < 0 ||
    home.x + k.width > plot.width ||
    home.y + k.depth > plot.depth
  )
    return false;
  return homes
    .filter((h) => h.id !== home.id)
    .every((h) => {
      const o = catalog.kits.find((k) => k.id === h.kitId);
      return (
        o &&
        (home.x + k.width <= h.x ||
          h.x + o.width <= home.x ||
          home.y + k.depth <= h.y ||
          h.y + o.depth <= home.y)
      );
    });
}
export function rosterForArea(found: Record<string, string[]>, area: string) {
  return Object.keys(found)
    .filter((id) => found[id].includes(area))
    .sort();
}
export function sharedFavorites(residents: Pokemon[]) {
  const count = new Map<string, number>();
  residents.forEach((p) =>
    p.favorites.forEach((f) => count.set(f, (count.get(f) || 0) + 1)),
  );
  return [...count]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
function pairScore(a: Pokemon, b: Pokemon) {
  if (!a.environment || !b.environment) return -100;
  return (
    (a.environment && b.environment
      ? a.environment === b.environment
        ? 100
        : -100
      : -20) +
    a.favorites.filter((f) => b.favorites.includes(f)).length * 10
  );
}
export function generatePlan(input: PlannerInput, catalog: Catalog): Plan {
  if (!validPlot(input.plot))
    throw Error("Plot dimensions must be whole numbers from 1 to 200.");
  const ids = [...new Set(input.roster)].sort();
  if (ids.some((id) => !catalog.pokemon.some((p) => p.id === id)))
    throw Error("Roster contains an unknown Pokémon.");
  const choices = input.kits.filter((c) =>
    catalog.kits.some((k) => k.id === c.id),
  );
  if (!choices.length) throw Error("Choose at least one supported home kit.");
  if (
    choices.some(
      (c) => c.limit !== null && (!Number.isInteger(c.limit) || c.limit < 0),
    )
  )
    throw Error("Kit limits must be non-negative whole numbers.");
  const pmap = new Map(catalog.pokemon.map((p) => [p.id, p]));
  // Try stable kit orderings, then keep the arrangement with the best served roster.
  const orders = [
    choices,
    [...choices].reverse(),
    [...choices].sort((a, b) => {
      const x = catalog.kits.find((k) => k.id === a.id)!;
      const y = catalog.kits.find((k) => k.id === b.id)!;
      return (
        (x.width * x.depth) / x.capacity - (y.width * y.depth) / y.capacity
      );
    }),
  ];
  const candidates = orders.map((order) => {
    const remaining = [...ids].sort((a, b) => {
      const p = pmap.get(a)!,
        q = pmap.get(b)!;
      return (
        Number(!p.environment) - Number(!q.environment) ||
        (p.environment || "").localeCompare(q.environment || "") ||
        a.localeCompare(b)
      );
    });
    const homes: Home[] = [];
    const used = new Map<string, number>();
    while (remaining.length) {
      let next: Home | null = null;
      for (const c of order) {
        if (c.limit !== null && (used.get(c.id) || 0) >= c.limit) continue;
        const k = catalog.kits.find((k) => k.id === c.id)!;
        for (let y = 0; y <= input.plot.depth - k.depth && !next; y++)
          for (let x = 0; x <= input.plot.width - k.width && !next; x++) {
            const candidate = {
              id: `home-${homes.length + 1}`,
              kitId: k.id,
              x,
              y,
              residents: [],
            };
            if (canPlace(candidate, homes, input.plot, catalog))
              next = candidate;
          }
        if (next) break;
      }
      if (!next) break;
      const anchor = pmap.get(remaining.shift()!)!;
      next.residents.push(anchor.id);
      const kit = catalog.kits.find((k) => k.id === next!.kitId)!;
      while (next.residents.length < kit.capacity && remaining.length) {
        const ranked = remaining
          .map((id) => ({
            id,
            score: Math.min(
              ...next!.residents.map((r) =>
                pairScore(pmap.get(r)!, pmap.get(id)!),
              ),
            ),
          }))
          .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
        // Comfort-first leaves conflicting/unknown environments in separate homes.
        if (ranked[0].score < 0) break;
        const id = ranked[0].id;
        next.residents.push(id);
        remaining.splice(remaining.indexOf(id), 1);
      }
      homes.push(next);
      used.set(next.kitId, (used.get(next.kitId) || 0) + 1);
    }
    const unplaced = remaining.map((id) => ({
      id,
      reason:
        "No room within the selected plot and kit limits for a comfort-first group.",
    }));
    const score = homes.reduce(
      (sum, h) =>
        sum +
        h.residents.length * 1000 +
        sharedFavorites(h.residents.map((id) => pmap.get(id)!)).reduce(
          (s, [, n]) => s + n,
          0,
        ),
      0,
    );
    return { homes, unplaced, score };
  });
  candidates.sort(
    (a, b) => b.score - a.score || a.homes.length - b.homes.length,
  );
  return {
    ...input,
    roster: ids,
    ...{ homes: candidates[0].homes, unplaced: candidates[0].unplaced },
    catalogVersion: catalog.version,
    createdAt: new Date().toISOString(),
  };
}
export function furnishings(residents: Pokemon[], items: Item[]) {
  const needed = new Set(residents.flatMap((p) => p.favorites));
  const selected: { item: Item; benefits: string[]; categories: string[] }[] =
    [];
  while (needed.size) {
    const ranked = items
      .map((item) => ({
        item,
        categories: item.categories.filter((f) => needed.has(f)),
      }))
      .filter((x) => x.categories.length)
      .sort(
        (a, b) =>
          b.categories.length - a.categories.length ||
          a.item.name.localeCompare(b.item.name),
      );
    if (!ranked.length) break;
    const best = ranked[0];
    selected.push({
      ...best,
      benefits: residents
        .filter((p) => p.favorites.some((f) => best.categories.includes(f)))
        .map((p) => p.id),
    });
    best.categories.forEach((f) => needed.delete(f));
  }
  return { selected, uncovered: [...needed] };
}
export function swapResidents(
  plan: Plan,
  from: string,
  to: string,
  resident: string,
  other: string | null,
  catalog: Catalog,
): Plan {
  const homes = plan.homes.map((h) => ({ ...h, residents: [...h.residents] }));
  const a = homes.find((h) => h.id === from),
    b = homes.find((h) => h.id === to);
  if (
    !a ||
    !b ||
    a === b ||
    !a.residents.includes(resident) ||
    (other && !b.residents.includes(other))
  )
    throw Error("Choose a valid resident and destination.");
  a.residents = a.residents.filter((id) => id !== resident);
  if (other) {
    b.residents = b.residents.filter((id) => id !== other);
    a.residents.push(other);
  }
  b.residents.push(resident);
  if (b.residents.length > catalog.kits.find((k) => k.id === b.kitId)!.capacity)
    throw Error("That home is full. Choose a resident to swap.");
  return { ...plan, homes };
}
