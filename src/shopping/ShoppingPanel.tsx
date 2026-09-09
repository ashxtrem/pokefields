import { useMemo, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { activePlannedBuilds } from "../habitats/builds";
import { useProgress } from "../progress/context";
import {
  combinedHabitatShopping,
  redistributeCombinedGathered,
  resetHabitatGathered,
  setBuildAllocationGathered,
} from "./allocations";
import {
  constructionReady,
  resetHouseGathered,
  rowRemaining,
  setHouseRowGathered,
  type HouseQuantityList,
  type QuantityRow,
} from "./checklists";
import { HouseQuantitySection, QuantityControls } from "./QuantityControls";

export function ShoppingPanel({
  scope,
  onClose,
}: {
  scope: "habitat" | "house";
  onClose: () => void;
}) {
  const { state, update, updateWithUndo, ready } = useProgress();
  const [filter, setFilter] = useState<"needed" | "all">("needed");
  const [buildId, setBuildId] = useState("");
  const builds = state.habitatBuilds || {};
  const planned = activePlannedBuilds(builds);
  const combined = useMemo(
    () => combinedHabitatShopping(builds, buildId ? [buildId] : undefined),
    [builds, buildId],
  );
  const houseList = state.houseShopping;
  const filteredCombined =
    filter === "needed"
      ? combined.filter((row) => row.remaining > 0)
      : combined;
  const filteredHouse = (rows: QuantityRow[]) =>
    filter === "needed" ? rows.filter((row) => rowRemaining(row) > 0) : rows;
  const canResetAll =
    scope === "habitat"
      ? combined.some((row) => row.gathered > 0)
      : Boolean(
          houseList &&
            [...houseList.construction, ...houseList.furnishings].some(
              (row) => row.gathered > 0,
            ),
        );
  const resetAll = () => {
    if (scope === "habitat") {
      updateWithUndo("Reset gathered", (saved) => ({
        ...saved,
        habitatBuilds: resetHabitatGathered(
          saved.habitatBuilds || {},
          buildId ? [buildId] : undefined,
        ),
      }));
      return;
    }
    updateWithUndo("Reset gathered", (saved) => ({
      ...saved,
      houseShopping: saved.houseShopping
        ? resetHouseGathered(saved.houseShopping)
        : saved.houseShopping,
    }));
  };

  return (
    <aside
      className="shopping-panel"
      role="dialog"
      aria-label={scope === "habitat" ? "Habitat list" : "House list"}
    >
      <div className="shopping-panel-head">
        <div>
          <span className="eyebrow">
            {scope === "habitat" ? "HABITAT LIST" : "HOUSE LIST"}
          </span>
          <h2>
            {scope === "habitat"
              ? "Gather for planned builds"
              : "Gather for this house"}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close shopping list"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <p className="muted shopping-note">
        Gathered means set aside for these builds. It is not automatically
        synchronized with game storage.
        {scope === "habitat" && houseList
          ? " Habitat and house gathered totals remain independent."
          : ""}
      </p>
      <div className="shopping-filters">
        <button
          type="button"
          className={filter === "needed" ? "chip active" : "chip"}
          onClick={() => setFilter("needed")}
        >
          Still needed
        </button>
        <button
          type="button"
          className={filter === "all" ? "chip active" : "chip"}
          onClick={() => setFilter("all")}
        >
          All items
        </button>
        {canResetAll && (
          <button
            type="button"
            className="text-button shopping-reset-all"
            disabled={!ready}
            onClick={resetAll}
          >
            <RotateCcw size={14} /> Reset all
          </button>
        )}
      </div>
      {scope === "habitat" ? (
        !planned.length ? (
          <div className="notice">
            No planned habitat builds yet. Plan a build from the Habitats
            catalog or a Pokémon detail page.
          </div>
        ) : (
          <>
            {planned.length > 1 && (
              <div className="region-chips build-filter-chips">
                <button
                  type="button"
                  className={!buildId ? "chip active" : "chip"}
                  onClick={() => setBuildId("")}
                >
                  All planned
                </button>
                {planned.map((build) => (
                  <button
                    type="button"
                    key={build.id}
                    className={buildId === build.id ? "chip active" : "chip"}
                    onClick={() => setBuildId(build.id)}
                  >
                    {build.snapshot.habitatName}
                    {build.region ? ` · ${build.region}` : ""}
                  </button>
                ))}
              </div>
            )}
            <p className="muted">
              {planned
                .filter((build) => !buildId || build.id === buildId)
                .reduce((sum, build) => sum + build.copies, 0)}{" "}
              planned copies ·{" "}
              {combined.filter((row) => row.remaining > 0).length} item types
              left to gather.
            </p>
            {filteredCombined.map((row) => (
              <div className="combined-row" key={row.key}>
                <QuantityControls
                  label={row.label}
                  required={row.required}
                  gathered={row.gathered}
                  disabled={!ready}
                  onHaveAll={() =>
                    updateWithUndo("Gathered supplies", (saved) => ({
                      ...saved,
                      habitatBuilds: redistributeCombinedGathered(
                        saved.habitatBuilds || {},
                        row.key,
                        row.required,
                      ),
                    }))
                  }
                  onReset={() =>
                    updateWithUndo("Reset gathered", (saved) => ({
                      ...saved,
                      habitatBuilds: redistributeCombinedGathered(
                        saved.habitatBuilds || {},
                        row.key,
                        0,
                      ),
                    }))
                  }
                  onChange={(value) =>
                    update((saved) => ({
                      ...saved,
                      habitatBuilds: redistributeCombinedGathered(
                        saved.habitatBuilds || {},
                        row.key,
                        value,
                      ),
                    }))
                  }
                />
                {row.contributions.length > 1 && (
                  <p className="muted gathering-hint">
                    Applied to oldest plans first; adjust per build below.
                  </p>
                )}
                <details className="build-contributions">
                  <summary>
                    {row.contributions.length === 1
                      ? "1 planned build"
                      : `${row.contributions.length} planned builds`}
                  </summary>
                  {row.contributions.map((contribution) => (
                    <div
                      className="contribution-block"
                      key={contribution.buildId}
                    >
                      <strong>{contribution.habitatName}</strong>
                      <p className="muted">
                        {builds[contribution.buildId]?.region} ·{" "}
                        {builds[contribution.buildId]?.locationNote ||
                          "No location note"}
                      </p>
                      <a
                        href={`#/habitats/${builds[contribution.buildId]?.habitatId}`}
                        onClick={onClose}
                      >
                        Manage build
                      </a>
                      {contribution.rows.map((alloc) => (
                        <QuantityControls
                          key={alloc.requirementId}
                          label={alloc.label}
                          required={alloc.required}
                          gathered={alloc.gathered}
                          disabled={!ready}
                          onChange={(value) =>
                            update((saved) => ({
                              ...saved,
                              habitatBuilds: setBuildAllocationGathered(
                                saved.habitatBuilds || {},
                                contribution.buildId,
                                alloc.requirementId,
                                value,
                              ),
                            }))
                          }
                          onHaveAll={() =>
                            update((saved) => ({
                              ...saved,
                              habitatBuilds: setBuildAllocationGathered(
                                saved.habitatBuilds || {},
                                contribution.buildId,
                                alloc.requirementId,
                                alloc.required,
                              ),
                            }))
                          }
                          onReset={() =>
                            updateWithUndo("Reset gathered", (saved) => ({
                              ...saved,
                              habitatBuilds: setBuildAllocationGathered(
                                saved.habitatBuilds || {},
                                contribution.buildId,
                                alloc.requirementId,
                                0,
                              ),
                            }))
                          }
                        />
                      ))}
                    </div>
                  ))}
                </details>
              </div>
            ))}
            {!filteredCombined.length && (
              <div className="notice">
                {combined.length
                  ? "All tracked supplies are ready. Open All items to adjust quantities, or manage your builds to mark them built."
                  : "These plans have no tracked item quantities. Check each habitat’s conditions and any requirements needing review."}
              </div>
            )}
          </>
        )
      ) : !state.housematePlan || !houseList ? (
        <div className="notice">
          No accepted housemate plan yet. Suggest housemates and apply a plan to
          start a house list.
        </div>
      ) : (
        <>
          <p className="muted">
            Construction readiness:{" "}
            {constructionReady(houseList)
              ? "Supplies ready"
              : "Still gathering construction materials"}
          </p>
          <HouseQuantitySection
            title="Required materials"
            rows={filteredHouse(houseList.construction)}
            disabled={!ready}
            onChange={(id, gathered) =>
              update((saved) => ({
                ...saved,
                houseShopping: setHouseRowGathered(
                  saved.houseShopping as HouseQuantityList,
                  "construction",
                  id,
                  gathered,
                ),
              }))
            }
          />
          <HouseQuantitySection
            title="Suggested furnishings"
            rows={filteredHouse(houseList.furnishings)}
            disabled={!ready}
            onChange={(id, gathered) =>
              update((saved) => ({
                ...saved,
                houseShopping: setHouseRowGathered(
                  saved.houseShopping as HouseQuantityList,
                  "furnishings",
                  id,
                  gathered,
                ),
              }))
            }
          />
        </>
      )}
    </aside>
  );
}
