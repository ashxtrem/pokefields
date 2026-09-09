import { BuildModal } from "./BuildModal";
import { HabitatPokemonChips } from "./HabitatPokemon";
import { CopyStepper, parseCopyCount, RegionChips } from "./BuildForm";
import { SupplyIcon } from "../shopping/SupplyIcon";
import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { useCatalog } from "../catalog/context";
import {
  habitatImageUrl,
  parseRequirement,
  type TermRef,
} from "../dex/glossary";
import { useProgress } from "../progress/context";
import {
  buildBadges,
  markBuilt,
  recordsForHabitat,
  setAllocationGathered,
  splitPartialBuilt,
  suppliesReady,
  updateBuildCopies,
  updateBuildLocation,
} from "../habitats/builds";
import { getCanonicalHabitat, listCanonicalHabitats } from "../habitats/catalog";
import {
  filtersFromQuery,
  habitatCatalogHref,
  habitatDetailHref,
} from "../habitats/search";
import { Empty, ExplainDialog, Modal } from "../ui/components";
import { QuantityControls } from "../shopping/QuantityControls";
import type { HabitatBuildRecord } from "../habitats/types";

export function HabitatDetail({ habitatId }: { habitatId: string }) {
  const catalog = useCatalog();
  const { state, update, updateWithUndo, ready } = useProgress();
  const habitat = getCanonicalHabitat(catalog, habitatId);
  const filters = useMemo(
    () =>
      filtersFromQuery(
        location.hash.includes("?")
          ? location.hash.slice(location.hash.indexOf("?") + 1)
          : "",
      ),
    [location.hash],
  );
  const [term, setTerm] = useState<TermRef | null>(null);
  const [buildMode, setBuildMode] = useState<"planned" | "built">("planned");
  const [planOpen, setPlanOpen] = useState(false);
  const builds = state.habitatBuilds || {};
  const records = habitat ? recordsForHabitat(builds, habitat.id) : [];
  const badge = buildBadges(records);
  if (!habitat)
    return (
      <Empty title="That habitat isn’t in this catalog">
        <a href="#/habitats">Return to Habitats</a>
      </Empty>
    );
  const src = habitatImageUrl(habitat.image);
  const region = records.find((r) => r.region)?.region || filters.region || "";
  const planned = records.filter((r) => r.status === "planned");
  const orderedHabitats = listCanonicalHabitats(catalog);
  const habitatIndex = orderedHabitats.findIndex((h) => h.id === habitat.id);
  const prevHabitat =
    habitatIndex > 0 ? orderedHabitats[habitatIndex - 1] : null;
  const nextHabitat =
    habitatIndex >= 0 && habitatIndex < orderedHabitats.length - 1
      ? orderedHabitats[habitatIndex + 1]
      : null;
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
          <HabitatPokemonChips habitat={habitat} region={region} showNames />
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
      <section className="habitat-build-actions">
        <div>
          <strong>
            {badge.built ? `${badge.built} built` : ""}
            {badge.built && badge.planned ? " · " : ""}
            {badge.planned ? `${badge.planned} planned` : ""}
            {!badge.built && !badge.planned ? "Not started" : ""}
          </strong>
        </div>
        <div className="button-row">
          {planned.length ? (
            <button
              className="button secondary"
              onClick={() =>
                document
                  .getElementById("habitat-builds")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Open planned build
            </button>
          ) : null}
          <button
            className="button"
            disabled={!ready}
            onClick={() => {
              setBuildMode("planned");
              setPlanOpen(true);
            }}
          >
            Plan build
          </button>
          <button
            className="button secondary"
            disabled={!ready}
            onClick={() => {
              setBuildMode("built");
              setPlanOpen(true);
            }}
          >
            Record built
          </button>
        </div>
      </section>
      <section id="habitat-builds">
        <h2>Your builds</h2>
        {!records.length ? (
          <p className="muted">No builds recorded yet.</p>
        ) : (
          records.map((record) => (
            <BuildRecordCard
              key={record.id}
              record={record}
              areas={catalog.areas}
              disabled={!ready}
              onUpdate={(next) =>
                update((saved) => ({
                  ...saved,
                  habitatBuilds: {
                    ...(saved.habitatBuilds || {}),
                    [next.id]: next,
                  },
                }))
              }
              onRemove={() =>
                updateWithUndo("Removed build", (saved) => {
                  const next = { ...(saved.habitatBuilds || {}) };
                  delete next[record.id];
                  return { ...saved, habitatBuilds: next };
                })
              }
              onMarkBuilt={(n) => {
                if (record.copies > 1 && record.status === "planned") {
                  updateWithUndo("Marked built", (saved) => {
                    const current = saved.habitatBuilds?.[record.id];
                    if (!current) return saved;
                    const { built, remaining } = splitPartialBuilt(current, n);
                    const buildsNext = { ...(saved.habitatBuilds || {}) };
                    delete buildsNext[record.id];
                    buildsNext[built.id] = built;
                    if (remaining) buildsNext[remaining.id] = remaining;
                    return { ...saved, habitatBuilds: buildsNext };
                  });
                  return;
                }
                updateWithUndo("Marked built", (saved) => ({
                  ...saved,
                  habitatBuilds: {
                    ...(saved.habitatBuilds || {}),
                    [record.id]: markBuilt(record),
                  },
                }));
              }}
            />
          ))
        )}
      </section>
      {planOpen && (
        <BuildModal
          habitatId={habitat.id}
          habitatName={habitat.name}
          mode={buildMode}
          onClose={() => setPlanOpen(false)}
        />
      )}
      {term && <ExplainDialog term={term} onClose={() => setTerm(null)} />}
    </div>
  );
}

function BuildRecordCard({
  record,
  areas,
  disabled,
  onUpdate,
  onRemove,
  onMarkBuilt,
}: {
  record: HabitatBuildRecord;
  areas: string[];
  disabled?: boolean;
  onUpdate: (record: HabitatBuildRecord) => void;
  onRemove: () => void;
  onMarkBuilt: (copies: number) => void;
}) {
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completedCopies, setCompletedCopies] = useState("1");
  const [copiesDraft, setCopiesDraft] = useState(String(record.copies));
  const [region, setRegion] = useState(record.region || "");
  const [note, setNote] = useState(record.locationNote);
  return (
    <article className="build-record-card">
      <div className="build-record-head">
        <strong>
          {record.status === "planned" ? "Planned" : "Built"} · {record.copies}{" "}
          {record.copies === 1 ? "copy" : "copies"}
        </strong>
        <span>
          <MapPin size={14} /> {record.region || "Choose a region"}
          {record.locationNote ? ` · ${record.locationNote}` : ""}
        </span>
        {!!record.reviewFlags?.length && (
          <p className="notice">{record.reviewFlags.join(" · ")}</p>
        )}
      </div>
      {record.status === "planned" && (
        <>
          {record.allocations.map((row) => (
            <QuantityControls
              key={row.requirementId}
              label={row.label}
              required={row.required}
              gathered={row.gathered}
              disabled={disabled}
              onChange={(value) =>
                onUpdate(
                  setAllocationGathered(record, row.requirementId, value),
                )
              }
              onHaveAll={() =>
                onUpdate(
                  setAllocationGathered(
                    record,
                    row.requirementId,
                    row.required,
                  ),
                )
              }
              onReset={() =>
                onUpdate(setAllocationGathered(record, row.requirementId, 0))
              }
            />
          ))}
          <p className="muted">
            Supplies ready:{" "}
            {suppliesReady(record) &&
            !record.snapshot.requirements.some((r) => r.kind === "review")
              ? "Yes"
              : "Still gathering"}
          </p>
        </>
      )}
      <RegionChips
        areas={areas}
        value={region}
        disabled={disabled}
        onChange={(next) => {
          setRegion(next);
          onUpdate(updateBuildLocation(record, next, note));
        }}
      />
      <label className="field">
        <span>Location note</span>
        <input
          value={note}
          disabled={disabled}
          onChange={(e) => {
            setNote(e.target.value);
            onUpdate(updateBuildLocation(record, region, e.target.value));
          }}
        />
      </label>
      {record.status === "planned" && (
        <>
          <CopyStepper
            value={copiesDraft}
            disabled={disabled}
            restoreOnBlur
            fallback={record.copies}
            onChange={(raw) => {
              setCopiesDraft(raw);
              const n = parseCopyCount(raw);
              if (n && n !== record.copies)
                onUpdate(updateBuildCopies(record, n));
            }}
          />
          <button
            className="button secondary"
            disabled={disabled}
            onClick={() => {
              setCompletedCopies(String(record.copies));
              setCompleteOpen(true);
            }}
          >
            Mark built
          </button>
        </>
      )}
      {completeOpen && (
        <Modal title="Mark copies built" onClose={() => setCompleteOpen(false)}>
          <p>
            {record.region || "Region not recorded"}
            {record.locationNote ? ` · ${record.locationNote}` : ""}
          </p>
          <CopyStepper
            label="Copies built"
            value={completedCopies}
            onChange={setCompletedCopies}
          />
          <p className="muted">
            Any unbuilt copies stay on your gathering list.
          </p>
          <button
            className="button full"
            disabled={
              disabled ||
              !Number.isSafeInteger(Number(completedCopies)) ||
              Number(completedCopies) < 1 ||
              Number(completedCopies) > record.copies
            }
            onClick={() => {
              onMarkBuilt(Number(completedCopies));
              setCompleteOpen(false);
            }}
          >
            Save built copies
          </button>
        </Modal>
      )}
      <button
        type="button"
        className="button secondary"
        disabled={disabled}
        onClick={onRemove}
      >
        Remove this build
      </button>
    </article>
  );
}
