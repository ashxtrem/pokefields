import { Check } from "lucide-react";
import { useCatalog } from "../catalog/context";
import { useProgress } from "../progress/context";
import { Portrait } from "../ui/components";
import { associationsForRegion, pokemonById } from "./catalog";
import type { CanonicalHabitat } from "./types";

/**
 * The attracted species, shown as linked portraits: found ones in full colour,
 * the rest desaturated so the remaining hunt reads at a glance. `showNames` is
 * the roomy detail-page variant; catalog cards use the icon-only one.
 */
export function HabitatPokemonChips({
  habitat,
  region = "",
  showNames = false,
  currentPokemonId,
}: {
  habitat: CanonicalHabitat;
  region?: string;
  showNames?: boolean;
  /** Marks the Pokemon whose own page is being viewed. */
  currentPokemonId?: string;
}) {
  const catalog = useCatalog();
  const { state } = useProgress();
  const index = pokemonById(catalog);
  // A species can be listed against the same habitat more than once; show it once.
  const seen = new Set<string>();
  const rows = associationsForRegion(habitat, region || null)
    .map((assoc) => {
      const pokemon = index.get(assoc.pokemonId);
      if (!pokemon || seen.has(assoc.pokemonId)) return null;
      seen.add(assoc.pokemonId);
      return { pokemon, assoc };
    })
    .filter((row) => row !== null);
  if (!rows.length) return null;
  const foundCount = rows.filter(
    (row) => state.found[row.pokemon.id]?.length,
  ).length;
  return (
    <div className={`habitat-pokemon ${showNames ? "" : "is-compact"}`}>
      <p className="habitat-pokemon-label">
        Attracts{" "}
        <strong>
          {foundCount}/{rows.length} found
        </strong>
        {region ? ` · filtered for ${region}` : ""}
      </p>
      <ul className="habitat-pokemon-list">
        {rows.map(({ pokemon, assoc }) => {
          const found = !!state.found[pokemon.id]?.length;
          const times = assoc.times.join(", ") || "time not recorded";
          const state_ = found ? "found" : "not found yet";
          const current = pokemon.id === currentPokemonId;
          return (
            <li key={pokemon.id}>
              <a
                className={`habitat-pokemon-chip ${found ? "is-found" : "is-missing"}${current ? " is-current" : ""}`}
                href={`#/pokemon/${pokemon.id}`}
                aria-current={current ? "page" : undefined}
                title={`${pokemon.name} — ${state_} · ${assoc.rarity} · ${times}`}
                aria-label={`${pokemon.name}${current ? ", this Pokémon" : ""}, ${state_}, ${assoc.rarity}, ${times}`}
              >
                <span className="habitat-pokemon-art">
                  <Portrait pokemon={pokemon} small />
                  {found && (
                    <span className="habitat-pokemon-mark" aria-hidden="true">
                      <Check size={11} />
                    </span>
                  )}
                </span>
                {showNames && (
                  <span className="habitat-pokemon-name">{pokemon.name}</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
