import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, MapPin, Check, Leaf, Info } from "lucide-react";
import type { Pokemon } from "../catalog/types";
import { useCatalog } from "../catalog/context";
import { recipesForOutputItem } from "../crafting/catalog";
import { recipeHref } from "../crafting/types";
import { useProgress } from "../progress/context";
import {
  explainTerm,
  itemImageUrl,
  pokemonArtUrl,
  resolveItem,
  specialtyImageUrl,
  type TermRef,
} from "../dex/glossary";
export function Portrait({
  pokemon,
  small = false,
}: {
  pokemon: Pokemon;
  small?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = pokemon.nationalNumber
    ? pokemonArtUrl(pokemon.nationalNumber, small)
    : null;
  useEffect(() => setFailed(false), [pokemon.id, small, src]);
  return (
    <span
      className={`portrait ${small ? "small" : ""}`}
      title="Reference species artwork; appearance may differ by form"
    >
      {src && !failed ? (
        <img
          draggable={false}
          src={src}
          alt={pokemon.name}
          loading="lazy"
          decoding="async"
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
  titleHref,
  onTitleClick,
  children,
  onClose,
  wide = false,
  sheet = false,
}: {
  title: string;
  titleHref?: string;
  onTitleClick?: () => void;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  sheet?: boolean;
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
      className={`modal${wide ? " wide" : ""}${sheet ? " sheet" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>
          {titleHref ? (
            <a href={titleHref} onClick={onTitleClick}>
              {title}
            </a>
          ) : (
            title
          )}
        </h2>
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
export function AreaMarks({
  pokemon,
  onExplain,
}: {
  pokemon: Pokemon;
  onExplain?: (term: TermRef) => void;
}) {
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
            <span className="area-name">{area}</span>
            <span className="area-actions">
              {onExplain && (
                <TermChip
                  term={{ kind: "area", value: area }}
                  onOpen={onExplain}
                  quiet
                />
              )}
              {selected.includes(area) && <Check size={16} />}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
export function SpecialtyIcon({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  const src = specialtyImageUrl(name);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const mark = name === "???" ? "?" : name.slice(0, 1);
  if (!src || failed) {
    return (
      <span
        className={`specialty-icon-fallback${large ? " large" : ""}`}
        aria-hidden="true"
      >
        {mark}
      </span>
    );
  }
  return (
    <img
      className={`specialty-icon${large ? " large" : ""}`}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
export function TermChip({
  term,
  onOpen,
  quiet = false,
  children,
}: {
  term: TermRef;
  onOpen: (term: TermRef) => void;
  quiet?: boolean;
  children?: ReactNode;
}) {
  const label = term.label || term.value;
  return (
    <button
      type="button"
      className={quiet ? "term-chip quiet" : "term-chip"}
      aria-haspopup="dialog"
      aria-label={`What ${label} means`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen(term);
      }}
    >
      {term.kind === "specialty" && !quiet ? <SpecialtyIcon name={term.value} /> : null}
      {quiet ? null : children || label}
      <Info size={quiet ? 16 : 12} />
    </button>
  );
}
/**
 * Baked artwork for an item or kit, by catalog id. Falls back to the first
 * letter so a missing bake never leaves an empty box.
 */
export function ItemThumb({
  id,
  name,
  large = false,
}: {
  id: string;
  name: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`item-thumb ${large ? "large" : ""}`}
      aria-hidden="true"
      title={name}
    >
      {failed ? (
        name.slice(0, 1)
      ) : (
        <img
          src={itemImageUrl(id)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
/**
 * An item or material name that opens the explain popup.
 * The button shows the name only; the surrounding row already prints the count.
 * Pass `quantity` with `context: "home"` for build materials so the popup says
 * what the count is for instead of the habitat-footprint wording.
 */
export function ItemButton({
  name,
  id,
  quantity,
  context,
  onOpen,
}: {
  name: string;
  id?: string;
  quantity?: number;
  context?: TermRef["context"];
  onOpen: (term: TermRef) => void;
}) {
  return (
    <button
      type="button"
      className="item-button"
      aria-haspopup="dialog"
      aria-label={`Where to find ${name}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen({
          kind: "item",
          value: name,
          id,
          quantity: quantity === undefined ? undefined : String(quantity),
          context,
        });
      }}
    >
      {name}
    </button>
  );
}
function ItemPic({
  src,
  name,
  large = false,
}: {
  src: string;
  name: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className={`item-pic-fallback ${large ? "large" : ""}`}>
        {name.slice(0, 1)}
      </span>
    );
  return (
    <img
      className={large ? "explain-hero" : "explain-thumb"}
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
export function ExplainDialog({
  term,
  onClose,
}: {
  term: TermRef;
  onClose: () => void;
}) {
  const catalog = useCatalog();
  const [stack, setStack] = useState<TermRef[]>([term]);
  useEffect(() => setStack([term]), [term]);
  const current = stack[stack.length - 1];
  const info = explainTerm(current, catalog.items);
  const open = (next: TermRef) => setStack((s) => [...s, next]);
  const recipes =
    current.kind === "item"
      ? recipesForOutputItem(
          catalog,
          resolveItem(current.id || current.value, catalog.items).id,
        )
      : [];
  const recipeLink = recipes[0];
  return (
    <Modal
      title={info.title}
      titleHref={recipeLink ? recipeHref(recipeLink.id) : undefined}
      onTitleClick={recipeLink ? onClose : undefined}
      onClose={onClose}
      sheet
    >
      <p className="explain-kind">{info.kindLabel}</p>
      {info.heroImage && (
        <ItemPic src={info.heroImage} name={info.title} large />
      )}
      <p>{info.meaning}</p>
      {info.obtain?.length ? (
        <>
          <h3 className="explain-sub">Where to find it</h3>
          <ul className="explain-obtain">
            {info.obtain.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      ) : info.achieve ? (
        <>
          <h3 className="explain-sub">How to get this</h3>
          <p>{info.achieve}</p>
        </>
      ) : null}
      {!!info.categories?.length && (
        <>
          <h3 className="explain-sub">Favorite categories</h3>
          <div className="term-row">
            {info.categories.map((category) => (
              <TermChip
                key={category}
                term={{ kind: "favorite", value: category }}
                onOpen={open}
              />
            ))}
          </div>
        </>
      )}
      {info.items.length > 0 && (
        <>
          {info.obtain?.some((line) =>
            /^(Cook with:|Craft from:)/i.test(line),
          ) ? (
            <h3 className="explain-sub">Ingredients</h3>
          ) : null}
          <div className="explain-items">
            {info.items.map((item) => (
              <button
                type="button"
                key={item.id}
                className="explain-item"
                onClick={() =>
                  open({ kind: "item", value: item.name, id: item.id })
                }
              >
                <ItemPic src={item.image} name="" />
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {stack.length > 1 && (
        <button
          className="text-button explain-back"
          onClick={() => setStack((s) => s.slice(0, -1))}
        >
          Back
        </button>
      )}
    </Modal>
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
