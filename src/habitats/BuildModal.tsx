import { useState } from "react";
import { useCatalog } from "../catalog/context";
import { useProgress } from "../progress/context";
import { Modal } from "../ui/components";
import { CopyStepper, parseCopyCount, RegionChips } from "./BuildForm";
import {
  createBuiltRecord,
  createPlannedBuild,
  recordsForHabitat,
} from "./builds";
import { habitatDetailHref } from "./search";

export function BuildModal({
  habitatId,
  habitatName,
  mode,
  onClose,
  originPokemonId,
}: {
  habitatId: string;
  habitatName: string;
  mode: "planned" | "built";
  onClose: () => void;
  originPokemonId?: string;
}) {
  const catalog = useCatalog();
  const { state, updateWithUndo, ready } = useProgress();
  const [region, setRegion] = useState("");
  const [copies, setCopies] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const copyCount = parseCopyCount(copies);
  const records = recordsForHabitat(state.habitatBuilds || {}, habitatId);
  const submitLabel =
    mode === "built" ? "Save built habitat" : "Create planned build";

  const save = () => {
    if (!ready) return;
    if (!region) {
      setError("Choose where this habitat is.");
      return;
    }
    if (!copyCount) {
      setError("Enter how many copies.");
      return;
    }
    const create = mode === "built" ? createBuiltRecord : createPlannedBuild;
    const record = create(
      catalog,
      habitatId,
      region,
      copyCount,
      note.trim(),
      originPokemonId,
    );
    updateWithUndo(
      mode === "built" ? "Recorded build" : "Planned build",
      (s) => ({
        ...s,
        habitatBuilds: { ...s.habitatBuilds, [record.id]: record },
      }),
    );
    setError("");
    setSavedMessage(
      mode === "built"
        ? `Recorded ${copyCount} built ${copyCount === 1 ? "copy" : "copies"} in ${region}.`
        : `Planned ${copyCount} ${copyCount === 1 ? "copy" : "copies"} in ${region}. Supplies are on your gathering list.`,
    );
    setCopies("1");
    setNote("");
  };

  return (
    <Modal
      sheet
      title={`${mode === "built" ? "Record built" : "Plan build"}: ${habitatName}`}
      onClose={onClose}
    >
      {savedMessage ? (
        <div className="notice" role="status">
          {savedMessage}
        </div>
      ) : (
        <p className="muted">
          {mode === "built"
            ? "Where did you build this habitat?"
            : "Choose where you want to build. We’ll add the supplies for every copy."}
        </p>
      )}
      <form
        className="build-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <RegionChips
          areas={catalog.areas}
          value={region}
          onChange={(next) => {
            setRegion(next);
            setError("");
          }}
          disabled={!ready}
        />
        <CopyStepper
          value={copies}
          onChange={(next) => {
            setCopies(next);
            setError("");
          }}
          disabled={!ready}
        />
        <label className="field">
          <span>Location note (optional)</span>
          <input
            placeholder="e.g. beside the Pokémon Center"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error ? (
          <p className="notice" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button full" type="submit" disabled={!ready}>
          {submitLabel}
        </button>
      </form>
      {!!records.length && (
        <section className="build-modal-records">
          <h3>Your builds</h3>
          {records.map((r) => (
            <div className="build-mini-record" key={r.id}>
              <div>
                <strong>
                  {r.copies} {r.status}
                </strong>
                <span>
                  {r.region || "Region not recorded"}
                  {r.locationNote ? ` · ${r.locationNote}` : ""}
                </span>
              </div>
              <button
                type="button"
                className="button secondary"
                disabled={!ready}
                onClick={() => {
                  setSavedMessage("");
                  updateWithUndo("Removed build", (s) => {
                    const builds = { ...s.habitatBuilds };
                    delete builds[r.id];
                    return { ...s, habitatBuilds: builds };
                  });
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </section>
      )}
      <div className="button-row">
        <a
          className="button secondary"
          href={habitatDetailHref(habitatId)}
          onClick={onClose}
        >
          Manage builds & supplies
        </a>
        {savedMessage ? (
          <button className="button" type="button" onClick={onClose}>
            Done
          </button>
        ) : (
          <button className="text-button" type="button" onClick={onClose}>
            Cancel
          </button>
        )}
      </div>
    </Modal>
  );
}
