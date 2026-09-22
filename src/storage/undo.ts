import { UNDO_EXPIRY_MS, UNDO_STACK_LIMIT } from "./constants";
import { newUid, type LocalStorageItem, type StorageChest } from "./types";

/**
 * Feature-scoped undo for Storage: separate from src/progress/context.tsx's global undo, which
 * only knows how to restore fields on the single SaveState blob and can't safely span these new
 * Dexie tables (see the plan's architecture notes). Covers manual edits, partial/complete scan
 * acceptance, local-item merges, and catalog links.
 */

export interface UndoSnapshot {
  chests: StorageChest[];
  localItems: LocalStorageItem[];
}

export interface UndoEntry {
  id: string;
  label: string;
  before: UndoSnapshot;
  createdAt: number;
}

export class StorageUndoStack {
  private stack: UndoEntry[] = [];

  push(label: string, before: UndoSnapshot): UndoEntry {
    const entry: UndoEntry = {
      id: newUid(),
      label,
      before: { chests: [...before.chests], localItems: [...before.localItems] },
      createdAt: Date.now(),
    };
    this.stack = [entry, ...this.stack].slice(0, UNDO_STACK_LIMIT);
    return entry;
  }

  peek(): UndoEntry | null {
    this.pruneExpired();
    return this.stack[0] ?? null;
  }

  /** Consumes and returns the most recent entry, or null when nothing is left to undo. */
  pop(): UndoEntry | null {
    this.pruneExpired();
    const [entry, ...rest] = this.stack;
    this.stack = rest;
    return entry ?? null;
  }

  /** Every image id referenced by a still-live undo entry — images GC must never delete. */
  protectedImageIds(): Set<string> {
    this.pruneExpired();
    const ids = new Set<string>();
    for (const entry of this.stack) {
      for (const chest of entry.before.chests) {
        if (chest.locationImageId) ids.add(chest.locationImageId);
        for (const slot of chest.unresolvedSlots ?? []) ids.add(slot.imageId);
      }
      for (const item of entry.before.localItems)
        if (item.thumbnailImageId) ids.add(item.thumbnailImageId);
    }
    return ids;
  }

  clear(): void {
    this.stack = [];
  }

  private pruneExpired() {
    const cutoff = Date.now() - UNDO_EXPIRY_MS;
    this.stack = this.stack.filter((entry) => entry.createdAt >= cutoff);
  }
}
