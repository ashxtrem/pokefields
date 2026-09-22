import { useState } from "react";
import { useCatalog } from "../catalog/context";
import { useStorage } from "./context";
import { storeLocationImage } from "./images";
import { storageChestHref, storageListHref } from "./search";
import { SLOT_COUNT } from "./constants";
import { StorageImageThumb } from "./StorageImageThumb";
import type { ChestType, StorageChest } from "./types";
import { ChestLimitError } from "./repository";

export const CHEST_TYPE_LABEL: Record<ChestType, string> = {
  "storage-box": `Storage box (${SLOT_COUNT["storage-box"]} slots, 1 screenshot)`,
  "big-storage-box": `Big storage box (${SLOT_COUNT["big-storage-box"]} slots, 3 screenshots)`,
};

export function ChestForm({
  mode,
  chest,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  chest?: StorageChest;
  onSaved?: (chestId: string) => void;
  onCancel?: () => void;
}) {
  const catalog = useCatalog();
  const { createChest, renameChest, editChest, chests } = useStorage();
  const [regionId, setRegionId] = useState(chest?.regionId ?? catalog.areas[0] ?? "");
  const [type, setType] = useState<ChestType>(chest?.type ?? "storage-box");
  const [name, setName] = useState(chest?.name ?? "");
  const [locationNote, setLocationNote] = useState(chest?.locationNote ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (mode === "create") {
        const created = await createChest({
          regionId,
          type,
          catalogVersion: catalog.version,
          name: name.trim() || undefined,
          locationNote: locationNote.trim() || undefined,
        });
        if (file) {
          const image = await storeLocationImage(file, created.id);
          await editChest(created.id, { locationImageId: image.id });
        }
        onSaved ? onSaved(created.id) : (location.hash = storageChestHref(created.id));
      } else if (chest) {
        if (name.trim() && name.trim() !== chest.name) await renameChest(chest.id, name.trim());
        let locationImageId = chest.locationImageId;
        if (file) locationImageId = (await storeLocationImage(file, chest.id)).id;
        await editChest(chest.id, {
          regionId,
          locationNote: locationNote.trim() || undefined,
          locationImageId,
        });
        onSaved?.(chest.id);
      }
    } catch (err) {
      setError(
        err instanceof ChestLimitError || err instanceof Error
          ? err.message
          : "This chest could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="storage-chest-form" onSubmit={submit}>
      <h1>{mode === "create" ? "New chest" : "Edit chest"}</h1>
      <label className="field">
        <span>Region</span>
        <select value={regionId} onChange={(e) => setRegionId(e.target.value)} required>
          {catalog.areas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Chest name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${regionId} · Chest ${String(chests.filter((c) => c.regionId === regionId).length + 1).padStart(2, "0")}`}
        />
      </label>
      {mode === "create" ? (
        <fieldset className="field">
          <legend>Chest type</legend>
          {(["storage-box", "big-storage-box"] as ChestType[]).map((option) => (
            <label key={option} className="radio-row">
              <input
                type="radio"
                name="chest-type"
                checked={type === option}
                onChange={() => setType(option)}
              />
              {CHEST_TYPE_LABEL[option]}
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="muted">
          Chest type ({CHEST_TYPE_LABEL[chest!.type]}) cannot be changed after a chest is created.
        </p>
      )}
      <label className="field">
        <span>Location screenshot or photo</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {chest?.locationImageId && !file ? (
        <StorageImageThumb
          imageId={chest.locationImageId}
          alt="Current chest location"
          className="storage-location-preview"
        />
      ) : null}
      <label className="field">
        <span>Location note (optional)</span>
        <textarea
          value={locationNote}
          onChange={(e) => setLocationNote(e.target.value)}
          placeholder="e.g. second floor, behind the bookcase"
        />
      </label>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button className="button" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save chest"}
        </button>
        <a
          className="button secondary"
          href={onCancel ? undefined : storageListHref()}
          onClick={(event) => {
            if (onCancel) {
              event.preventDefault();
              onCancel();
            }
          }}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
