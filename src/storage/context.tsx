import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useCatalog } from "../catalog/context";
import {
  deleteChestRow,
  deleteLocalItemRow,
  loadAllChests,
  loadAllLocalItems,
  putChest,
  putLocalItem,
  replaceAllStorageData,
  restoreChestsAndLocalItems,
} from "./db";
import { collectReferencedImageIds, garbageCollectImages } from "./images";
import {
  buildLocalItem,
  chestsReferencingLocalItem,
  editLocalItemNote as editLocalItemNoteFn,
  isLocalItemReferenced,
  markLinkedToCatalog,
  markMergedInto,
  renameLocalItem as renameLocalItemFn,
  rewriteChestsForCatalogLink,
  rewriteChestsForMerge,
  setLocalItemThumbnail as setLocalItemThumbnailFn,
} from "./localItems";
import {
  buildChest,
  editChestDetails,
  renameChest as renameChestFn,
  withCompleteScanReplaced,
  withItemRefQuantity,
  withItemRefRemoved,
  withItemRefReplaced,
  withItemRefsAdded,
  withPartialScanMerged,
  withUnresolvedSlotResolved,
  type CreateChestInput,
} from "./repository";
import { StorageUndoStack, type UndoEntry } from "./undo";
import type { LocalStorageItem, StorageChest, StorageImage, StorageItemRef, UnresolvedSlot } from "./types";

interface StorageContextValue {
  ready: boolean;
  error: string;
  chests: StorageChest[];
  localItems: LocalStorageItem[];
  unreadableChests: number;
  unreadableLocalItems: number;
  pendingUndo: { label: string } | null;
  undoError: string;
  createChest: (input: CreateChestInput) => Promise<StorageChest>;
  renameChest: (chestId: string, name: string) => Promise<void>;
  editChest: (
    chestId: string,
    fields: Partial<Pick<StorageChest, "regionId" | "locationNote" | "locationImageId" | "locationMarker">>,
  ) => Promise<void>;
  deleteChest: (chestId: string) => Promise<void>;
  addItemRefs: (chestId: string, refs: StorageItemRef[]) => Promise<void>;
  removeItemRef: (chestId: string, ref: StorageItemRef) => Promise<void>;
  /** Player's own tracking number for one item reference — never computed/used by the app itself. */
  setItemQuantity: (chestId: string, ref: StorageItemRef, quantity: number | undefined) => Promise<void>;
  replaceItemRef: (chestId: string, oldRef: StorageItemRef, newRef: StorageItemRef) => Promise<void>;
  acceptPartialScan: (
    chestId: string,
    refs: StorageItemRef[],
    unresolvedSlots: UnresolvedSlot[],
  ) => Promise<void>;
  acceptCompleteScan: (
    chestId: string,
    refs: StorageItemRef[],
    unresolvedSlots: UnresolvedSlot[],
  ) => Promise<void>;
  resolveUnresolvedSlot: (chestId: string, slotId: string) => Promise<void>;
  createLocalItem: (fields: { name: string; note?: string; thumbnailImageId?: string }) => Promise<LocalStorageItem>;
  renameLocalItem: (id: string, name: string) => Promise<void>;
  editLocalItemNote: (id: string, note: string) => Promise<void>;
  setLocalItemThumbnail: (id: string, thumbnailImageId: string | undefined) => Promise<void>;
  mergeLocalItems: (fromId: string, toId: string) => Promise<void>;
  linkLocalItemToCatalog: (localItemId: string, catalogItemId: string) => Promise<void>;
  deleteLocalItem: (id: string) => Promise<void>;
  chestsReferencing: (localItemId: string) => StorageChest[];
  undo: () => Promise<void>;
  runGarbageCollection: () => Promise<number>;
  /** Backup restore: replaces every Storage table and refreshes in-memory state to match. */
  replaceAllData: (chests: StorageChest[], localItems: LocalStorageItem[], images: StorageImage[]) => Promise<void>;
}

const Context = createContext<StorageContextValue | null>(null);

export function StorageProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog();
  const [chests, setChests] = useState<StorageChest[]>([]);
  const [localItems, setLocalItems] = useState<LocalStorageItem[]>([]);
  const [unreadableChests, setUnreadableChests] = useState(0);
  const [unreadableLocalItems, setUnreadableLocalItems] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [undoError, setUndoError] = useState("");
  const [pendingUndo, setPendingUndo] = useState<UndoEntry | null>(null);

  const chestsRef = useRef(chests);
  const localItemsRef = useRef(localItems);
  const undoStack = useRef(new StorageUndoStack());

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadAllChests(catalog), loadAllLocalItems()])
      .then(([chestResult, localResult]) => {
        if (cancelled) return;
        chestsRef.current = chestResult.items;
        localItemsRef.current = localResult.items;
        setChests(chestResult.items);
        setLocalItems(localResult.items);
        setUnreadableChests(chestResult.unreadableCount);
        setUnreadableLocalItems(localResult.unreadableCount);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled)
          setError("Storage data could not be opened. Reload or enable browser storage before editing.");
      });
    return () => {
      cancelled = true;
    };
  }, [catalog.version]);

  const snapshot = useCallback(
    () => ({ chests: chestsRef.current, localItems: localItemsRef.current }),
    [],
  );

  const setChestsState = useCallback((next: StorageChest[]) => {
    chestsRef.current = next;
    setChests(next);
  }, []);

  const setLocalItemsState = useCallback((next: LocalStorageItem[]) => {
    localItemsRef.current = next;
    setLocalItems(next);
  }, []);

  /**
   * Fire-and-forget cleanup after an operation that can orphan an image (resolving/replacing a
   * scan, deleting a chest, editing its location photo). Failures are non-fatal — an unreferenced
   * image just waits for the next GC pass rather than blocking the mutation that triggered it.
   */
  const gcSoon = useCallback(() => {
    const protectedIds = undoStack.current.protectedImageIds();
    const referenced = collectReferencedImageIds(chestsRef.current, localItemsRef.current, protectedIds);
    garbageCollectImages(referenced).catch(() => {});
  }, []);

  const pushUndo = useCallback(
    (label: string) => {
      const entry = undoStack.current.push(label, snapshot());
      setPendingUndo(entry);
      setUndoError("");
    },
    [snapshot],
  );

  const getChest = useCallback((chestId: string): StorageChest => {
    const chest = chestsRef.current.find((c) => c.id === chestId);
    if (!chest) throw new Error("This chest no longer exists.");
    return chest;
  }, []);

  const persistChest = useCallback(
    async (next: StorageChest) => {
      await putChest(next);
      setChestsState(chestsRef.current.map((c) => (c.id === next.id ? next : c)));
    },
    [setChestsState],
  );

  const persistLocalItem = useCallback(
    async (next: LocalStorageItem) => {
      await putLocalItem(next);
      setLocalItemsState(
        localItemsRef.current.some((item) => item.id === next.id)
          ? localItemsRef.current.map((item) => (item.id === next.id ? next : item))
          : [...localItemsRef.current, next],
      );
    },
    [setLocalItemsState],
  );

  const createChest = useCallback(
    async (input: CreateChestInput) => {
      const chest = buildChest(input, chestsRef.current);
      await putChest(chest);
      setChestsState([...chestsRef.current, chest]);
      return chest;
    },
    [setChestsState],
  );

  const renameChest = useCallback(
    async (chestId: string, name: string) => {
      await persistChest(renameChestFn(getChest(chestId), name));
    },
    [getChest, persistChest],
  );

  const editChest = useCallback(
    async (
      chestId: string,
      fields: Partial<Pick<StorageChest, "regionId" | "locationNote" | "locationImageId" | "locationMarker">>,
    ) => {
      await persistChest(editChestDetails(getChest(chestId), fields));
      if (fields.locationImageId !== undefined) gcSoon();
    },
    [gcSoon, getChest, persistChest],
  );

  const deleteChest = useCallback(
    async (chestId: string) => {
      await deleteChestRow(chestId);
      setChestsState(chestsRef.current.filter((c) => c.id !== chestId));
      gcSoon();
    },
    [gcSoon, setChestsState],
  );

  const addItemRefs = useCallback(
    async (chestId: string, refs: StorageItemRef[]) => {
      pushUndo("adding items");
      await persistChest(withItemRefsAdded(getChest(chestId), refs));
    },
    [getChest, persistChest, pushUndo],
  );

  const removeItemRef = useCallback(
    async (chestId: string, ref: StorageItemRef) => {
      pushUndo("removing an item");
      await persistChest(withItemRefRemoved(getChest(chestId), ref));
    },
    [getChest, persistChest, pushUndo],
  );

  const setItemQuantity = useCallback(
    async (chestId: string, ref: StorageItemRef, quantity: number | undefined) => {
      await persistChest(withItemRefQuantity(getChest(chestId), ref, quantity));
    },
    [getChest, persistChest],
  );

  const replaceItemRef = useCallback(
    async (chestId: string, oldRef: StorageItemRef, newRef: StorageItemRef) => {
      pushUndo("replacing an item");
      await persistChest(withItemRefReplaced(getChest(chestId), oldRef, newRef));
    },
    [getChest, persistChest, pushUndo],
  );

  const acceptPartialScan = useCallback(
    async (chestId: string, refs: StorageItemRef[], unresolvedSlots: UnresolvedSlot[]) => {
      pushUndo("a partial rescan");
      await persistChest(withPartialScanMerged(getChest(chestId), refs, unresolvedSlots));
    },
    [getChest, persistChest, pushUndo],
  );

  const acceptCompleteScan = useCallback(
    async (chestId: string, refs: StorageItemRef[], unresolvedSlots: UnresolvedSlot[]) => {
      pushUndo("a complete rescan");
      await persistChest(withCompleteScanReplaced(getChest(chestId), refs, unresolvedSlots));
      gcSoon();
    },
    [gcSoon, getChest, persistChest, pushUndo],
  );

  const resolveUnresolvedSlot = useCallback(
    async (chestId: string, slotId: string) => {
      await persistChest(withUnresolvedSlotResolved(getChest(chestId), slotId));
      gcSoon();
    },
    [gcSoon, getChest, persistChest],
  );

  const createLocalItem = useCallback(
    async (fields: { name: string; note?: string; thumbnailImageId?: string }) => {
      const item = buildLocalItem(fields);
      await putLocalItem(item);
      setLocalItemsState([...localItemsRef.current, item]);
      return item;
    },
    [setLocalItemsState],
  );

  const getLocalItem = useCallback((id: string): LocalStorageItem => {
    const item = localItemsRef.current.find((candidate) => candidate.id === id);
    if (!item) throw new Error("This local item no longer exists.");
    return item;
  }, []);

  const renameLocalItem = useCallback(
    async (id: string, name: string) => {
      await persistLocalItem(renameLocalItemFn(getLocalItem(id), name));
    },
    [getLocalItem, persistLocalItem],
  );

  const editLocalItemNote = useCallback(
    async (id: string, note: string) => {
      await persistLocalItem(editLocalItemNoteFn(getLocalItem(id), note));
    },
    [getLocalItem, persistLocalItem],
  );

  const setLocalItemThumbnail = useCallback(
    async (id: string, thumbnailImageId: string | undefined) => {
      await persistLocalItem(setLocalItemThumbnailFn(getLocalItem(id), thumbnailImageId));
    },
    [getLocalItem, persistLocalItem],
  );

  const mergeLocalItems = useCallback(
    async (fromId: string, toId: string) => {
      if (fromId === toId) return;
      pushUndo("merging local items");
      const from = getLocalItem(fromId);
      const rewrittenChests = rewriteChestsForMerge(chestsRef.current, fromId, toId);
      const mergedFrom = markMergedInto(from, toId);
      for (const chest of rewrittenChests) {
        if (chest !== chestsRef.current.find((c) => c.id === chest.id)) await putChest(chest);
      }
      await putLocalItem(mergedFrom);
      setChestsState(rewrittenChests);
      setLocalItemsState(localItemsRef.current.map((item) => (item.id === fromId ? mergedFrom : item)));
    },
    [getLocalItem, pushUndo, setChestsState, setLocalItemsState],
  );

  const linkLocalItemToCatalog = useCallback(
    async (localItemId: string, catalogItemId: string) => {
      pushUndo("linking a local item to the catalog");
      const item = getLocalItem(localItemId);
      const rewrittenChests = rewriteChestsForCatalogLink(chestsRef.current, localItemId, catalogItemId);
      const linked = markLinkedToCatalog(item, catalogItemId);
      for (const chest of rewrittenChests) {
        if (chest !== chestsRef.current.find((c) => c.id === chest.id)) await putChest(chest);
      }
      await putLocalItem(linked);
      setChestsState(rewrittenChests);
      setLocalItemsState(localItemsRef.current.map((candidate) => (candidate.id === localItemId ? linked : candidate)));
    },
    [getLocalItem, pushUndo, setChestsState, setLocalItemsState],
  );

  const deleteLocalItem = useCallback(
    async (id: string) => {
      if (isLocalItemReferenced(id, chestsRef.current))
        throw new Error("This local item is still used in a chest. Remove or replace those references first.");
      await deleteLocalItemRow(id);
      setLocalItemsState(localItemsRef.current.filter((item) => item.id !== id));
    },
    [setLocalItemsState],
  );

  const chestsReferencing = useCallback(
    (localItemId: string) => chestsReferencingLocalItem(localItemId, chestsRef.current),
    [],
  );

  const undo = useCallback(async () => {
    const entry = undoStack.current.pop();
    setPendingUndo(undoStack.current.peek());
    if (!entry) {
      setUndoError("Nothing left to undo.");
      return;
    }
    try {
      await restoreChestsAndLocalItems(entry.before.chests, entry.before.localItems);
      setChestsState(entry.before.chests);
      setLocalItemsState(entry.before.localItems);
      setUndoError("");
    } catch {
      setUndoError("Could not undo that change.");
    }
  }, [setChestsState, setLocalItemsState]);

  const replaceAllData = useCallback(
    async (nextChests: StorageChest[], nextLocalItems: LocalStorageItem[], images: StorageImage[]) => {
      await replaceAllStorageData(nextChests, nextLocalItems, images);
      undoStack.current.clear();
      setPendingUndo(null);
      setChestsState(nextChests);
      setLocalItemsState(nextLocalItems);
    },
    [setChestsState, setLocalItemsState],
  );

  const runGarbageCollection = useCallback(async () => {
    const protectedIds = undoStack.current.protectedImageIds();
    const referenced = collectReferencedImageIds(chestsRef.current, localItemsRef.current, protectedIds);
    return garbageCollectImages(referenced);
  }, []);

  return (
    <Context.Provider
      value={{
        ready,
        error,
        chests,
        localItems,
        unreadableChests,
        unreadableLocalItems,
        pendingUndo,
        undoError,
        createChest,
        renameChest,
        editChest,
        deleteChest,
        addItemRefs,
        removeItemRef,
        setItemQuantity,
        replaceItemRef,
        acceptPartialScan,
        acceptCompleteScan,
        resolveUnresolvedSlot,
        createLocalItem,
        renameLocalItem,
        editLocalItemNote,
        setLocalItemThumbnail,
        mergeLocalItems,
        linkLocalItemToCatalog,
        deleteLocalItem,
        chestsReferencing,
        undo,
        runGarbageCollection,
        replaceAllData,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useStorage() {
  const c = useContext(Context);
  if (!c) throw Error("Missing storage provider");
  return c;
}
