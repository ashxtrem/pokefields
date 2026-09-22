/**
 * Centralized, deliberately small tunables for the Storage Locator feature. Keep these as the
 * single source of truth (see docs/storage-locator-feature-master-prompt.md, "Chest limit" and
 * "Image budgets") — do not duplicate these numbers elsewhere.
 */

/** Provisional product limit, not a claim about browser storage capacity. */
export const MAX_CHESTS = 100;

export const SLOT_COUNT: Record<"storage-box" | "big-storage-box", number> = {
  "storage-box": 20,
  "big-storage-box": 60,
};

export const PAGE_COUNT: Record<"storage-box" | "big-storage-box", number> = {
  "storage-box": 1,
  "big-storage-box": 3,
};

/** Slots per screenshot page — the native 2x10 grid, regardless of chest type. */
export const SLOTS_PER_PAGE = 20;

/** Location image: resized so the long edge is at most this many pixels. */
export const LOCATION_IMAGE_MAX_EDGE = 1280;
export const LOCATION_IMAGE_QUALITY = 0.82;

/** Local-item / unresolved-slot thumbnails: small, roughly square crops. */
export const THUMBNAIL_SIZE = 160;
export const THUMBNAIL_QUALITY = 0.85;

/** Reject an image that is still larger than this after compression and ask the player to retry. */
export const MAX_COMPRESSED_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * Legacy JSON backups (a bare SaveState) were capped at 5MB. Compressed chest location photos and
 * thumbnails can push a full "My notebook" export well past that for an active Storage user, so
 * the envelope-v2 import cap is raised to a documented, easily revised constant instead. Revisit
 * this after measuring real exports on supported browsers.
 */
export const MAX_BACKUP_IMPORT_BYTES = 60 * 1024 * 1024;

export const RECOGNITION_INDEX_VERSION = 1;
export const RECOGNITION_INDEX_URL = `/data/storage-reference-index.v${RECOGNITION_INDEX_VERSION}.json`;

export const UNDO_STACK_LIMIT = 8;
/** How long a feature-scoped undo entry (and the images it protects from GC) stays available. */
export const UNDO_EXPIRY_MS = 60_000;
