/** navigator.storage helpers — best-effort, since neither API is universally available. */

export interface QuotaEstimate {
  usage: number;
  quota: number;
  ratio: number;
}

export async function estimateStorage(): Promise<QuotaEstimate | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota, ratio: quota ? usage / quota : 0 };
  } catch {
    return null;
  }
}

/** A conservative warning line — never claims persistence is guaranteed. */
export function storageWarning(estimate: QuotaEstimate | null): string | null {
  if (!estimate || estimate.ratio < 0.85) return null;
  return "This browser's storage for Pokopia Fieldnotes is nearly full. Export a backup before adding more chests or images.";
}

/** Must be called from an explicit, user-initiated action — never automatically. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function isStoragePersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}
