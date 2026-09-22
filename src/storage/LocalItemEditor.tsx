import { useState } from "react";
import { Modal } from "../ui/components";
import { useStorage } from "./context";
import { storeThumbnailImage } from "./images";
import { StorageImageThumb } from "./StorageImageThumb";
import { storageChestHref } from "./search";
import type { LocalStorageItem } from "./types";

/** Rename/edit-note/replace-thumbnail/merge/view-referencing-chests for one local item. */
export function LocalItemEditor({ item, onClose }: { item: LocalStorageItem; onClose: () => void }) {
  const { localItems, renameLocalItem, editLocalItemNote, setLocalItemThumbnail, mergeLocalItems, deleteLocalItem, chestsReferencing } =
    useStorage();
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note ?? "");
  const [error, setError] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const referencingChests = chestsReferencing(item.id);
  const mergeCandidates = localItems.filter((candidate) => candidate.id !== item.id && !candidate.mergedIntoLocalItemId);

  const save = async () => {
    setError("");
    try {
      if (name.trim() && name.trim() !== item.name) await renameLocalItem(item.id, name.trim());
      if (note !== (item.note ?? "")) await editLocalItemNote(item.id, note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "This local item could not be saved.");
    }
  };

  return (
    <Modal title={`Edit "${item.name}"`} onClose={onClose}>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="field">
        <span>Note (optional)</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <label className="field">
        <span>Thumbnail</span>
        <input
          type="file"
          accept="image/*"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const image = await storeThumbnailImage(file, item.id, "local-item");
              await setLocalItemThumbnail(item.id, image.id);
            } catch (err) {
              setError(err instanceof Error ? err.message : "This image could not be used.");
            }
          }}
        />
      </label>
      {item.thumbnailImageId ? (
        <StorageImageThumb imageId={item.thumbnailImageId} alt="" className="storage-location-preview" />
      ) : null}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button type="button" className="button" onClick={save}>
          Save
        </button>
        <button type="button" className="button secondary" onClick={onClose}>
          Close
        </button>
      </div>

      <hr />
      <h3>Chests referencing this item</h3>
      {referencingChests.length === 0 ? (
        <p className="muted">Not currently recorded in any chest.</p>
      ) : (
        <ul className="storage-chest-list">
          {referencingChests.map((chest) => (
            <li key={chest.id}>
              <a href={storageChestHref(chest.id)}>{chest.name}</a>
            </li>
          ))}
        </ul>
      )}

      <hr />
      <h3>Merge into another local item</h3>
      {mergeCandidates.length === 0 ? (
        <p className="muted">No other local items to merge with.</p>
      ) : (
        <div className="button-row">
          <select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}>
            <option value="">Choose an item…</option>
            {mergeCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="button secondary"
            disabled={!mergeTargetId}
            onClick={async () => {
              await mergeLocalItems(item.id, mergeTargetId);
              onClose();
            }}
          >
            Merge
          </button>
        </div>
      )}

      <hr />
      <button
        type="button"
        className="button secondary"
        onClick={async () => {
          try {
            await deleteLocalItem(item.id);
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "This local item could not be deleted.");
          }
        }}
      >
        Delete this local item
      </button>
    </Modal>
  );
}
