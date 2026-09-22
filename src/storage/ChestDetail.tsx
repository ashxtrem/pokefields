import { useState } from "react";
import { Plus, ScanLine, X } from "lucide-react";
import { useCatalog } from "../catalog/context";
import { Empty, ItemThumb, Modal } from "../ui/components";
import { CHEST_TYPE_LABEL } from "./ChestForm";
import { ChestForm } from "./ChestForm";
import { useStorage } from "./context";
import { ItemPicker } from "./ItemPicker";
import { LocalItemEditor } from "./LocalItemEditor";
import { ScanFlow } from "./ScanFlow";
import { StorageImageThumb } from "./StorageImageThumb";
import { resolveItemRefName, storageListHref } from "./search";
import { itemRefKey, type StorageItemRef } from "./types";

export function ChestDetail({ chestId }: { chestId: string }) {
  const catalog = useCatalog();
  const { chests, localItems, removeItemRef, addItemRefs, deleteChest, resolveUnresolvedSlot, ready } =
    useStorage();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [resolvingSlotId, setResolvingSlotId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingLocalItemId, setEditingLocalItemId] = useState<string | null>(null);

  const chest = chests.find((c) => c.id === chestId);

  if (!ready) return <div className="loading">Opening this chest…</div>;
  if (!chest) return <MissingChest />;

  if (editing) {
    return (
      <ChestForm
        mode="edit"
        chest={chest}
        onSaved={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const nameFor = (ref: StorageItemRef) => resolveItemRefName(ref, catalog, localItems);

  return (
    <div className="storage-chest-detail">
      <a className="back-link" href={storageListHref()}>
        ← Storage
      </a>
      <header className="storage-chest-header">
        {chest.locationImageId ? (
          <StorageImageThumb imageId={chest.locationImageId} alt="" className="storage-location-hero" />
        ) : null}
        <div>
          <h1>{chest.name}</h1>
          <p className="muted">
            {chest.regionId} · {CHEST_TYPE_LABEL[chest.type]}
          </p>
          {chest.locationNote ? <p>{chest.locationNote}</p> : null}
          <p className="muted">Updated {new Date(chest.updatedAt).toLocaleString()}</p>
        </div>
      </header>
      <div className="button-row">
        <button type="button" className="button secondary" onClick={() => setEditing(true)}>
          Edit chest
        </button>
        <button type="button" className="button" onClick={() => setScanning(true)}>
          <ScanLine size={16} />
          Import screenshot
        </button>
        <button type="button" className="button secondary" onClick={() => setConfirmingDelete(true)}>
          Delete chest
        </button>
      </div>

      <section>
        <h2>
          Contents · {chest.itemRefs.length} unique recorded item{chest.itemRefs.length === 1 ? "" : "s"}
        </h2>
        {chest.itemRefs.length === 0 ? (
          <p className="muted">No items recorded yet. Add them manually or import a screenshot.</p>
        ) : (
          <ul className="storage-item-list">
            {chest.itemRefs.map((ref) => (
              <li key={itemRefKey(ref)}>
                {ref.kind === "catalog" ? (
                  <ItemThumb id={ref.itemId} name={nameFor(ref)} />
                ) : (
                  <span className="item-thumb" aria-hidden="true">
                    {nameFor(ref).slice(0, 1)}
                  </span>
                )}
                <span>{nameFor(ref)}</span>
                {ref.kind === "local" ? (
                  <button
                    type="button"
                    className="storage-source-badge local"
                    onClick={() => setEditingLocalItemId(ref.localItemId)}
                  >
                    Saved by me
                  </button>
                ) : null}
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${nameFor(ref)}`}
                  onClick={() => removeItemRef(chest.id, ref)}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {adding ? (
          <ItemPicker
            onPick={(ref) => {
              addItemRefs(chest.id, [ref]);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button type="button" className="button secondary" onClick={() => setAdding(true)}>
            <Plus size={16} />
            Add item
          </button>
        )}
      </section>

      {chest.unresolvedSlots?.length ? (
        <section>
          <h2>Review unidentified items · {chest.unresolvedSlots.length}</h2>
          <p className="muted">
            These slots could not be confidently matched during a screenshot scan. Assign them
            manually or ignore them.
          </p>
          <ul className="storage-unresolved-list">
            {chest.unresolvedSlots.map((slot) => (
              <li key={slot.id}>
                <StorageImageThumb
                  imageId={slot.imageId}
                  alt={`Unidentified item, page ${slot.page} slot ${slot.slot}`}
                  className="storage-unresolved-thumb"
                />
                {resolvingSlotId === slot.id ? (
                  <ItemPicker
                    onPick={async (ref) => {
                      await addItemRefs(chest.id, [ref]);
                      await resolveUnresolvedSlot(chest.id, slot.id);
                      setResolvingSlotId(null);
                    }}
                    onCancel={() => setResolvingSlotId(null)}
                  />
                ) : (
                  <div className="button-row">
                    <button type="button" className="button secondary" onClick={() => setResolvingSlotId(slot.id)}>
                      Identify
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => resolveUnresolvedSlot(chest.id, slot.id)}
                    >
                      Ignore
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {scanning ? <ScanFlow chest={chest} onClose={() => setScanning(false)} /> : null}

      {confirmingDelete ? (
        <Modal title="Delete this chest?" onClose={() => setConfirmingDelete(false)}>
          <p>
            This removes "{chest.name}", its location image, and its recorded contents. This
            cannot be undone.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button"
              onClick={async () => {
                await deleteChest(chest.id);
                location.hash = storageListHref();
              }}
            >
              Delete chest
            </button>
            <button type="button" className="button secondary" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}

      {editingLocalItemId ? (
        (() => {
          const item = localItems.find((candidate) => candidate.id === editingLocalItemId);
          return item ? (
            <LocalItemEditor item={item} onClose={() => setEditingLocalItemId(null)} />
          ) : null;
        })()
      ) : null}
    </div>
  );
}

export function MissingChest() {
  return (
    <div className="storage-chest-detail">
      <a className="back-link" href={storageListHref()}>
        ← Storage
      </a>
      <Empty title="This chest is no longer here">
        It may have been deleted, or the link is out of date.
      </Empty>
    </div>
  );
}
