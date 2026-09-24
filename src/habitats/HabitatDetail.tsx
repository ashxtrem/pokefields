import { HabitatPokemonChips } from "./HabitatPokemon";
import { CopyStepper, parseCopyCount, RegionChips } from "./LocationForm";
import { SupplyIcon } from "../ui/SupplyIcon";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Pencil } from "lucide-react";
import { useCatalog } from "../catalog/context";
import {
  habitatImageUrl,
  parseRequirement,
  type TermRef,
} from "../dex/glossary";
import { useProgress } from "../progress/context";
import {
  createLocation,
  locationsForHabitat,
  updateLocation,
} from "./locations";
import { getCanonicalHabitat, listCanonicalHabitats } from "./catalog";
import {
  filtersFromQuery,
  habitatCatalogHref,
  habitatDetailHref,
} from "./search";
import { Empty, ExplainDialog } from "../ui/components";
import type { HabitatLocationRecord } from "./types";

function readQuery() {
  return location.hash.includes("?")
    ? location.hash.slice(location.hash.indexOf("?") + 1)
    : "";
}

export function HabitatDetail({ habitatId }: { habitatId: string }) {
  const catalog = useCatalog();
  const { state, update, updateWithUndo, ready } = useProgress();
  const habitat = getCanonicalHabitat(catalog, habitatId);
  const query = readQuery();
  const filters = useMemo(() => filtersFromQuery(query), [query]);
  const params = useMemo(() => new URLSearchParams(query), [query]);
  const [term, setTerm] = useState<TermRef | null>(null);
  const [editingId, setEditingId] = useState<string | null>(
    params.get("edit"),
  );
  const [addingNew, setAddingNew] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const locations = state.habitatLocations || {};
  const records = habitat ? locationsForHabitat(locations, habitat.id) : [];

  useEffect(() => {
    if (params.get("focus") === "my-locations" || params.get("edit")) {
      sectionRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    // Only run once, when this page mounts for this habitat + query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!habitat)
    return (
      <Empty title="That habitat isn't in this catalog">
        <a href="#/habitats">Return to Habitats</a>
      </Empty>
    );
  const src = habitatImageUrl(habitat.image);
  const orderedHabitats = listCanonicalHabitats(catalog);
  const habitatIndex = orderedHabitats.findIndex((h) => h.id === habitat.id);
  const prevHabitat =
    habitatIndex > 0 ? orderedHabitats[habitatIndex - 1] : null;
  const nextHabitat =
    habitatIndex >= 0 && habitatIndex < orderedHabitats.length - 1
      ? orderedHabitats[habitatIndex + 1]
      : null;

  const saveEdit = (
    record: HabitatLocationRecord,
    fields: { region: string; note: string; copies: number },
  ) => {
    update((saved) => ({
      ...saved,
      habitatLocations: {
        ...(saved.habitatLocations || {}),
        [record.id]: updateLocation(record, fields),
      },
    }));
    setEditingId(null);
  };

  const removeLocation = (record: HabitatLocationRecord) => {
    updateWithUndo(
      "Removed location",
      (saved) => {
        const next = { ...(saved.habitatLocations || {}) };
        delete next[record.id];
        return { ...saved, habitatLocations: next };
      },
      ["habitatLocations"],
    );
    setEditingId(null);
  };

  const addLocation = (fields: {
    region: string;
    note: string;
    copies: number;
  }) => {
    const record = createLocation(
      habitat,
      fields.region,
      fields.copies,
      fields.note,
    );
    updateWithUndo(
      `Saved ${habitat.name} in ${fields.region}`,
      (saved) => ({
        ...saved,
        habitatLocations: {
          ...(saved.habitatLocations || {}),
          [record.id]: record,
        },
      }),
      ["habitatLocations"],
    );
    setAddingNew(false);
  };

  return (
    <div className="detail-page habitat-detail-page">
      <div className="detail-page-header">
        <a className="back-link" href={habitatCatalogHref(filters)}>
          ← Back to Habitats
        </a>
        <div className="detail-pager">
          {prevHabitat ? (
            <a
              className="button secondary detail-pager-link"
              href={habitatDetailHref(prevHabitat.id, filters)}
            >
              ← {prevHabitat.name}
            </a>
          ) : (
            <button className="button secondary" disabled>
              ← Previous
            </button>
          )}
          {nextHabitat ? (
            <a
              className="button secondary detail-pager-link"
              href={habitatDetailHref(nextHabitat.id, filters)}
            >
              {nextHabitat.name} →
            </a>
          ) : (
            <button className="button secondary" disabled>
              Next →
            </button>
          )}
        </div>
      </div>
      <div className="habitat-detail-hero">
        {src ? (
          <img className="habitat-image" src={src} alt={habitat.name} />
        ) : (
          <div className="habitat-image habitat-image-placeholder">
            No image
          </div>
        )}
        <div>
          <div className="eyebrow">ATTRACTING HABITAT</div>
          <h1>{habitat.name}</h1>
          <p>
            {habitat.possiblePokemonCount} possible Pokémon ·{" "}
            {habitat.discoveryRegions.length
              ? habitat.discoveryRegions.join(", ")
              : "Region not recorded"}
          </p>
          {!!habitat.conflicts.length && (
            <p className="notice">{habitat.conflicts.join(" · ")}</p>
          )}
          <HabitatPokemonChips
            habitat={habitat}
            region={filters.region}
            showNames
          />
        </div>
      </div>
      <section>
        <h2>Required supplies</h2>
        <div className="habitat-requirement-grid">
          {habitat.requirements.map((raw) => {
            const requirement = parseRequirement(raw);
            return (
              <div className="habitat-requirement" key={raw}>
                <SupplyIcon label={requirement.name} />
                <button
                  type="button"
                  className="requirement-name"
                  onClick={() =>
                    setTerm({
                      kind: requirement.kind,
                      value: requirement.name,
                      quantity: requirement.quantity,
                      label: raw,
                    })
                  }
                >
                  {raw}
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <section id="my-locations" ref={sectionRef}>
        <div className="my-locations-heading">
          <div>
            <h2>My locations</h2>
            <p className="muted">Places where you built this habitat.</p>
          </div>
          {!!records.length && (
            <span className="count-pill">
              {records.length} saved
            </span>
          )}
        </div>
        {!records.length && !addingNew ? (
          <p className="muted">
            No saved locations yet. Choose a region above or add one here.
          </p>
        ) : (
          records.map((record) => (
            <LocationRow
              key={record.id}
              record={record}
              areas={catalog.areas}
              editing={editingId === record.id}
              disabled={!ready}
              onEdit={() => setEditingId(record.id)}
              onCancel={() => setEditingId(null)}
              onSave={(fields) => saveEdit(record, fields)}
              onRemove={() => removeLocation(record)}
            />
          ))
        )}
        {addingNew ? (
          <NewLocationRow
            areas={catalog.areas}
            defaultRegion={filters.region}
            disabled={!ready}
            onCancel={() => setAddingNew(false)}
            onSave={addLocation}
          />
        ) : (
          <button
            type="button"
            className="button secondary"
            disabled={!ready}
            onClick={() => setAddingNew(true)}
          >
            Add another location
          </button>
        )}
      </section>
      {term && <ExplainDialog term={term} onClose={() => setTerm(null)} />}
    </div>
  );
}

function LocationRow({
  record,
  areas,
  editing,
  disabled,
  onEdit,
  onCancel,
  onSave,
  onRemove,
}: {
  record: HabitatLocationRecord;
  areas: string[];
  editing: boolean;
  disabled?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (fields: { region: string; note: string; copies: number }) => void;
  onRemove: () => void;
}) {
  const [region, setRegion] = useState(record.region || "");
  const [note, setNote] = useState(record.note);
  const [copies, setCopies] = useState(String(record.copies));
  const noteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setRegion(record.region || "");
      setNote(record.note);
      setCopies(String(record.copies));
      noteRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (!editing) {
    return (
      <article className="location-row-view">
        <span className="pin" aria-hidden="true">
          <MapPin size={18} />
        </span>
        <div className="place">
          <strong>{record.region || "Choose a region"}</strong>
          <span>{record.note || "No landmark note"}</span>
          {!!record.reviewFlags?.length && (
            <p className="notice">{record.reviewFlags.join(" · ")}</p>
          )}
        </div>
        <span className="copies">
          {record.copies} here
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label={`Edit ${record.habitatNameSnapshot} location in ${record.region || "an unrecorded region"}`}
          disabled={disabled}
          onClick={onEdit}
        >
          <Pencil size={16} />
        </button>
      </article>
    );
  }

  const copyCount = parseCopyCount(copies);
  return (
    <article className="location-row-edit">
      <RegionChips areas={areas} value={region} onChange={setRegion} disabled={disabled} />
      <label className="field">
        <span>Landmark or note (optional)</span>
        <input
          ref={noteRef}
          value={note}
          disabled={disabled}
          placeholder="e.g. beside the Pokémon Center"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <CopyStepper value={copies} onChange={setCopies} disabled={disabled} />
      <div className="button-row">
        <button
          type="button"
          className="button"
          disabled={disabled || !region || !copyCount}
          onClick={() => onSave({ region, note, copies: copyCount || 1 })}
        >
          Save
        </button>
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </article>
  );
}

function NewLocationRow({
  areas,
  defaultRegion,
  disabled,
  onCancel,
  onSave,
}: {
  areas: string[];
  defaultRegion: string;
  disabled?: boolean;
  onCancel: () => void;
  onSave: (fields: { region: string; note: string; copies: number }) => void;
}) {
  const validDefault = areas.includes(defaultRegion) ? defaultRegion : "";
  const [region, setRegion] = useState(validDefault);
  const [note, setNote] = useState("");
  const [copies, setCopies] = useState("1");
  const copyCount = parseCopyCount(copies);
  return (
    <article className="location-row-edit">
      <RegionChips areas={areas} value={region} onChange={setRegion} disabled={disabled} />
      <label className="field">
        <span>Landmark or note (optional)</span>
        <input
          value={note}
          disabled={disabled}
          placeholder="e.g. beside the Pokémon Center"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <CopyStepper value={copies} onChange={setCopies} disabled={disabled} />
      <div className="button-row">
        <button
          type="button"
          className="button"
          disabled={disabled || !region || !copyCount}
          onClick={() => onSave({ region, note, copies: copyCount || 1 })}
        >
          Save
        </button>
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </article>
  );
}
