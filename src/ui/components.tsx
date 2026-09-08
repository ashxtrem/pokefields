import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, MapPin, Check, Leaf } from "lucide-react";
import type { Pokemon } from "../catalog/types";
import { useCatalog } from "../catalog/context";
import { useProgress } from "../progress/context";
export function Portrait({
  pokemon,
  small = false,
}: {
  pokemon: Pokemon;
  small?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const image = pokemon.nationalNumber
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.nationalNumber}.png`
    : pokemon.image;
  return (
    <span
      className={`portrait ${small ? "small" : ""}`}
      title="Reference species artwork; appearance may differ by form"
    >
      {image && !failed ? (
        <img
          draggable={false}
          src={image}
          alt={pokemon.name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="portrait-fallback" aria-label={pokemon.name}>
          {pokemon.name.slice(0, 2)}
        </span>
      )}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function AreaMarks({ pokemon }: { pokemon: Pokemon }) {
  const { areas } = useCatalog();
  const { state, update, ready } = useProgress();
  const selected = state.found[pokemon.id] || [];
  return (
    <div>
      <p className="muted">
        Mark every area where you have befriended {pokemon.name}. Each area is
        saved separately.
      </p>
      <div className="area-options">
        {areas.map((area) => (
          <label
            key={area}
            className={selected.includes(area) ? "selected" : ""}
          >
            <input
              type="checkbox"
              disabled={!ready}
              checked={selected.includes(area)}
              onChange={() =>
                update((s) => ({
                  ...s,
                  found: {
                    ...s.found,
                    [pokemon.id]: (s.found[pokemon.id] || []).includes(area)
                      ? s.found[pokemon.id].filter((a) => a !== area)
                      : [...(s.found[pokemon.id] || []), area],
                  },
                }))
              }
            />
            <MapPin size={17} />
            {area}
            {selected.includes(area) && <Check size={16} />}
          </label>
        ))}
      </div>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Leaf size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function SourceLink({
  url,
  label = "View reference",
}: {
  url: string;
  label?: string;
}) {
  return (
    <a className="source-link" href={url} target="_blank" rel="noreferrer">
      {label} ↗
    </a>
  );
}
