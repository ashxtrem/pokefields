# Storage scan — live review, background run, and completion toast

## Purpose

Importing a storage screenshot currently parks the player on a waiting screen until every occupied slot has been matched. This plan replaces that wait with the review itself: rows appear as soon as the page has been read, each row shows its icon when that slot finishes, and the player can leave for Pokédex, Habitats, Items, Storage, or Housemates while matching continues. The web app and the Capacitor Android app share this behavior. Both run the same `src/` scan session. A full page reload on web, and a WebView process death on Android, are the same boundary: the work lives in this page’s memory, so it ends and the chest is unchanged.

Nothing in this plan changes match accuracy, the reference index, candidate counts, or when a chest is written. The chest still changes only when the player accepts on the review.

## Current behavior

Verified against the code as of this plan.

1. **The scan is owned by the chest screen.** `ChestDetail` mounts `ScanFlow` only while `scanning` is true (`src/storage/ChestDetail.tsx`). `App` swaps the route content when the player changes section (`src/App.tsx`), which unmounts `ChestDetail`. `ScanFlow`’s effect cleanup then calls `cancelScan` and `terminateOcrWorker` (`src/storage/ScanFlow.tsx`). Leaving the chest is therefore a cancel.

2. **Results arrive as one batch.** `prepareScanSlots` (`src/storage/recognition/scanPrepare.ts`) runs on the main thread first: crop, shared background, occupied versus empty, thumbnail. Only occupied slots are sent to the worker pool. `worker.ts` matches those slots one by one and posts `{ type: "progress", done, total }` after each, then a single `{ type: "result", results }` when the chunk finishes. On cancel it posts `{ type: "cancelled" }` and drops the outcomes it had already computed. `runMatchTasks` (`src/storage/recognition/scanWorkerPool.ts`) only forwards the count. `ScanFlow` builds the review model after the whole promise resolves, then sets `stage` to `"review"`.

3. **The waiting screen is a count and a native progress bar.** Copy is `Scanning… N of M slots`, plus Cancel. The confirm dialog says recognition progress will be lost and the window will close. Confirm calls `cancelScan` and `onClose()`, which unmounts the flow. Resolved slots are not kept.

4. **Review is a second screen, after matching.** `ScanReview` lists occupied slots only (`outcome !== null`), in page and slot order, each with the cropped thumbnail, a catalog icon when matched, and Replace / Identify / Ignore / quantity. Empty slots are omitted. Save is `acceptPartialScan` (merge, keep items from pages that were not in this attempt) or `acceptCompleteScan` (replace the chest, only offered when every page of that chest type was uploaded). “Cancel without changing this chest” writes nothing.

5. **The worker pool already outlives one dialog.** `scanWorkerPool.ts` keeps workers for the page session and cancel is a soft cancel (`{ type: "cancel", scanId }`), so the OpenCV instance and reference index stay warm. That lifetime is what a background scan should use. The review state does not have it: outcomes, thumbnails, and in-progress decisions all live in `ScanFlow` / `ScanReview` component state.

6. **There is no toast.** Status UI in the shell is the save error and the undo notice in `App.tsx`. Scan progress is `aria-live="polite"` on the waiting screen only, so every slot tick is announced there.

## Product decisions

These are locked for the implementation. They come from the review of this flow, not from a new product direction.

- Hitting Scan opens the review layout immediately. The upload step stays where it is, before the first scan.
- Rows are the occupied slots of the uploaded pages, in page then slot order. Empty slots never become rows.
- A row shows the cropped slot image as soon as that list exists. The catalog icon and name appear on that same row when the slot’s outcome arrives. Rows do not reorder and do not append as results trickle in.
- A progress bar and Cancel sit on the review. Cancel confirms first. Stopping keeps slots that already have an outcome and drops slots still loading. The chest is not written.
- “Scan remaining” uses the screenshots already chosen. It skips a slot when that page and slot already matched, or the player has already accepted, replaced, or ignored it. Unfinished slots are matched again. Unresolved slots are matched again unless the player has already identified them by hand. A replaced image for a page scans that page fresh. Skip is by `page:slot` on this screenshot, never by “this item is already in the chest.”
- Changing section does not cancel. One scan runs at a time. The header shows a status on every section while it runs, and that status is the way back and the place Cancel still lives. On Android this includes the system Back button leaving the review or the chest: Back closes the topmost surface and does not cancel the scan.
- When matching finishes, a toast appears on whatever section the player is on, unless they are already looking at that review. The toast means the review is ready. It does not mean the chest was updated. On Android the toast is the same in-app notice, including after the player returns from Home if the process is still alive.
- Merge and Replace stay disabled until the scan has finished or been stopped.
- A reload on web, and the WebView process being killed on Android, end the session with no recovery and no leave prompt. The notebook is used beside the game; a prompt on every refresh or Home press would nag for a session that cannot be resumed anyway.

## Target experience

### 1. Upload, then Scan

The capture step is unchanged: one file per page, shape check, duplicate-page notice, Scan disabled until at least one supported page is ready. Scan is the commit.

On click, the capture step is replaced by the review shell in the same modal:

- Title stays “Review scan results”.
- Header row: indeterminate bar, “Reading the page…”, Cancel.
- The row list is empty during this stretch. Occupied slots are not known yet.

`prepareScanSlots` still runs on the main thread. The shell must be committed to React state before that await, so the player sees the review immediately. This first stretch can make the next screen slightly less responsive. That is accepted. Matching, which is the long part, already runs on the worker pool.

### 2. Rows appear together

When prepare returns:

- Occupied slots become rows, all at once, sorted by page then slot.
- Each row shows `Page N · slot M`, the cropped thumbnail, and a quiet loading line where the name will be.
- Replace, Identify, Ignore, and quantity are hidden on a row until it has an outcome.
- The bar becomes determinate: `done / occupied`. Empties are not in the total, so the bar does not jump before any icon appears. Copy: “4 of 11 slots”.
- Empty slots are discarded from the visible list. Their count is not announced.

### 3. Icons fill in place

Each occupied slot’s outcome is applied to the row with that `page:slot` key.

- `matched`: catalog icon and item name fade in. Score and margin stay as they are today. Default decision is accept, same as `ScanReview` does now.
- `unresolved`: the existing unresolved line, no catalog icon. Default decision is unresolved.
- The row’s actions appear with the outcome.

If the player is still on the review, they may Replace, Identify, Ignore, or set quantity on any resolved row while later rows are still loading. Those decisions live in the session, so leaving and coming back keeps them.

### 4. Finish on the review

When every occupied slot has an outcome, the bar completes, the header status clears, and Merge / Replace enable. No toast if this review is the open view. “Back to pages” returns to the capture step with the same files still chosen. “Cancel without changing this chest” confirms when any row has an outcome, then drops the session and writes nothing.

### 5. Stop

Cancel asks first. Copy:

> Stopping keeps the slots already identified in this review. Slots still loading will be dropped. Nothing is saved to this chest until you accept.

Confirm sends the soft cancel. Rows with an outcome stay, with their decisions. Rows still loading are removed. Phase becomes stopped. Merge and Replace enable for whatever remains. The header status clears. If they stopped from the header while on another section, the toast is “{chest name} scan stopped — N slots ready to review.” Tapping it opens that review.

### 6. Scan remaining

Shown on the review when the phase is stopped or ready, the original files are still in the session, and at least one slot on those files still needs a match.

A slot needs a match when:

- it never received an outcome (it was still loading when the scan stopped), or
- its outcome is `unresolved` and the player has not accepted, replaced, or ignored it.

A slot is skipped when:

- its outcome is `matched`, or
- the player’s decision is accept or ignored, including a manual identify on a previously unresolved slot.

“Scan remaining” does not re-decode pages whose file hash is unchanged. Prepare still has to classify the page if that page has slots needing a match and its prepared slots were dropped; if the prepared occupied list for that file hash is still in the session, only the skipped-filter is applied and those tasks are sent to the pool.

Replacing the file for a page (different hash) drops that page’s rows and prepared slots. The next scan of that page is fresh. Other pages in the same session are untouched.

“Scan remaining” is hidden when every occupied slot on the current files is skipped by the rules above.

### 7. Leave the chest

Choosing Pokédex, Habitats, Items, Storage, Housemates, or another chest unmounts the review view and does not cancel. The modal closes. The session keeps preparing or matching.

The app header shows one status on every section while the phase is preparing or matching:

> Scanning {chest name}…

Tapping it routes to that chest and opens the live review. Cancel on the status uses the same confirm dialog as on the review. There is no second scan entry: Import screenshot on any chest, while a session is preparing or matching, does not start another job. It offers to open the one that is running.

Reopening the same chest mid-scan opens the live review directly, with resolved rows, decisions, and loading rows as they are. It does not return to the upload step.

### 8. Toast

One toast, in the same shell band as the undo notice, on every route.

| Event | Player is looking at this review | Player is anywhere else |
|---|---|---|
| Scan reaches ready | Status clears. No toast. | “{chest name} is ready to review.” |
| Scan fails | The review shows the error and returns to the pages they chose. | “{chest name} could not be scanned.” Tap returns to that capture step with the error. |
| Chest deleted during the session | Session ends. | “Scan stopped. That chest was deleted.” |
| Player stops the scan from the header while away | — | “{chest name} scan stopped — N slots ready to review.” |

The toast stays until tap or dismiss. Dismiss leaves the session in place. Tap on ready or stopped opens the review. A second event replaces the toast; only one is visible.

If they open the chest without tapping the toast, `ChestDetail` still opens the review whenever a session exists for that chest id. The toast is a notification, not the only door.

### 9. Save

Unchanged semantics:

- Merge calls `acceptPartialScan`. Pages that were not uploaded keep their previously recorded items.
- Replace calls `acceptCompleteScan`, still only when this attempt included every page of the chest type, and still behind the existing confirm dialog.
- Both stay disabled while the phase is preparing or matching, including after the player has edited resolved rows.
- Accepting either one clears the session.
- Stopping a scan does not change `isCompleteAttempt`. A stopped scan of all pages may still offer Replace, and it saves only the rows that remain.

Quantity, dedupe, unresolved-slot images, and undo labels stay as they are.

## Session model

A new `ScanSessionProvider` wraps `App` inside `StorageProvider` (`src/main.tsx`), so the header and the chest screen share it and so it can see the chest list. It is not stored in IndexedDB. A reload starts from idle.

One session or none.

```ts
type ScanPhase = "preparing" | "matching" | "stopped" | "ready" | "failed";

interface ScanSession {
  id: string;
  chestId: string;
  chestName: string;
  phase: ScanPhase;
  /** True while the review modal for this session is mounted. */
  reviewOpen: boolean;
  isCompleteAttempt: boolean;
  error: string;
  pages: Array<{
    page: number;
    file: File;
    hash: string;
  }>;
  /** Occupied slots for the current file hash. Empty slots are omitted. */
  rows: ScanRow[];
  progress: { done: number; total: number };
}

interface ScanRow {
  page: number;
  slot: number;
  thumbnail: Blob;
  outcome: RecognitionOutcome | null; // null = still loading
  decision: Decision | null;           // null until an outcome exists
}
```

`Decision` stays the review’s existing union: `accept` (with optional quantity), `ignored`, `unresolved`.

The provider owns:

- starting a scan from the capture step’s files
- applying each streamed outcome onto `rows` by `page:slot`
- soft-cancel that retains rows whose `outcome` is non-null
- computing the skip set for “Scan remaining”
- `reviewOpen`, set by the review view on mount and cleared on unmount without cancelling
- ending the session when the chest id disappears from `chests`, when the player discards, or when a save succeeds
- the toast record: `{ kind, chestId, message } | null`

Prepared match inputs (`grey`, descriptor) for the current file hashes are kept in a ref beside the session, not in React state. They are only needed to enqueue “Scan remaining” without re-reading the bitmap. They are dropped when the file hash for that page changes, when the session ends, or on reload.

`ScanFlow` becomes the capture step plus a host that renders `ScanReview` against the session. It must not cancel in its unmount cleanup. `terminateOcrWorker` on unmount goes away with that cleanup; OCR teardown stays tied to session end, not to navigation.

## Protocol change

The pool has to deliver each outcome as the slot finishes, and it has to hand back outcomes already computed when the player stops.

`ScanWorkerResponse` gains:

```ts
| { type: "slot"; scanId: string; result: MatchTaskResult }
```

`worker.ts`, inside the per-task loop, after a successful match:

- post `{ type: "slot", scanId, result: { id, outcome } }`
- then post the existing progress message

On cancel, post `{ type: "result", scanId, results }` for the tasks completed before the break, then `{ type: "cancelled", scanId }`. Tasks not started are absent. The in-flight task that has not posted `slot` yet is dropped, which matches “slots still loading are dropped.”

`runMatchTasks` gains an `onSlot(id, outcome)` callback invoked for each `slot` message whose `scanId` matches. The final promise still resolves the full map on success. On cancel it resolves `{ status: "cancelled", results }` containing every `slot` message already applied, rather than the string `"cancelled"` that throws those results away. Callers that only care about completion keep working if they check the status.

Progress `total` for the UI is the occupied-row count in the session, not `pages × 20`. The worker’s own `done/total` stays per chunk; the session increments `progress.done` from `slot` messages so a two-worker pool cannot double-count.

This does not change `matchOccupiedSlot`, thresholds, or which slots are sent. It only changes when the main thread hears about a result.

## Motion

Operate motion, same language as the rest of the notebook (`tab-reveal` is 140ms, `cubic-bezier(0.16, 1, 0.3, 1)`).

- The review shell replaces the capture step with that opacity arrival.
- After prepare, rows appear together. No stagger that grows with slot count.
- A loading row pulses the name line’s opacity only. The thumbnail stays still.
- A resolved name and catalog icon fade in over 160ms with the shared easing. Layout does not move; the loading line occupies the same row.
- The determinate bar is `transform: scaleX(done / total)` with `transform-origin: left`, not an animated `width`. Indeterminate, during prepare, is a short translate on the bar’s fill. `will-change` is set only while the phase is preparing or matching.
- `prefers-reduced-motion`: no pulse and no traveling indeterminate fill. The status text and the change from loading line to icon remain.

No new dependency. No spinner, shimmer, blur, or bounce.

`aria-live` moves to the header status and announces phase changes (“Reading the page”, “Scanning {name}”, “Ready to review”), not each slot.

## Header and toast placement

Both render in `App`, above route content, next to the existing undo notice, so they survive the route swap.

The status is a single row: chest name, the same bar the review uses (indeterminate or determinate from `session.progress`), a control that navigates to the chest, and Cancel. It is visible for `preparing` and `matching` only.

The toast is a `role="status"` notice. It does not trap focus and does not cover the nav. One toast at a time.

`reviewOpen` is what suppresses the ready toast. The review sets it true on mount and false on unmount. Navigating away clears it and arms the toast for whenever the phase next becomes `ready`, `failed`, or `stopped`.

## Chest deletion and the one-scan rule

`ScanSessionProvider` watches `chests`. If `session.chestId` is missing, it soft-cancels any in-flight scan id, drops the session, and sets the deleted toast.

While the phase is `preparing` or `matching`:

- `ChestDetail`’s Import screenshot opens the running review when the chest id matches, and explains that a scan is already running when it does not.
- No second `runMatchTasks` is started.

While the phase is `stopped`, `ready`, or `failed`, Import on a different chest is allowed only after the player discards or saves the current session. The header does not show a running status in those phases; the toast and the chest’s own review are the reminders. Starting a new scan while an unsaved review exists asks them to discard that review first, so two sets of thumbnails are not held at once.

## Android

The Android app is the same React UI inside a Capacitor WebView (`androidScheme: "https"`, packaged assets, no service worker). Screenshot recognition already runs there on one worker. This plan does not add an Android-only scan screen, a distribution branch in the review, or a native notification.

No new scan code reads `VITE_DISTRIBUTION`. The one existing branch stays where it is: `defaultPoolSize()` in `scanWorkerPool.ts` returns 1 on Android. A second worker is a memory risk on the devices that build targets, and this UI does not need it. Streaming slot results works with a pool of one.

| Player action | Scan |
|---|---|
| Switch section inside the app (Pokédex, Habitats, Items, Storage, Housemates) | Keeps running. Header status stays. Toast when it finishes, unless the review is open. |
| System Back while the confirm dialog is open | Closes the dialog. The scan keeps running. |
| System Back from the review | Closes the review (`reviewOpen` becomes false) and stays on the chest. The scan keeps running. The header status is the way back. |
| System Back from the chest while a scan is running | Leaves the chest for the previous route. The scan keeps running. |
| Home, or switching to another Android app | Does not cancel and does not call `worker.terminate()`. The WebView may freeze until resume. If the process is still alive when they return, matching continues or the in-app toast is already there. |
| Swipe the app away, or Android kills the WebView | Same as a web reload. The session is gone. The chest is unchanged. |

The toast is not an Android system notification. The app has no notification permission and no foreground service, and a frozen WebView cannot be relied on to post one after the player has left. The notice they asked for is the in-app toast, visible on any section once the app is on screen again.

Back handling, when `@capacitor/app` is wired, uses the order already in `docs/android-play-store-release-plan.md` §5.2. This plan adds one rule to that order: closing the review or leaving the chest is not a scan cancel, and it is not a discard of identified rows. Discard still requires the review’s own confirm (“Cancel without changing this chest”). The release plan’s line against Back silently discarding an import review is satisfied by that confirm, not by keeping the modal pinned open.

Screenshot choice stays the existing file input. It opens the system picker inside the WebView. This plan does not add a camera permission or a storage permission.

Header status and toast use the shell’s existing safe-area padding so they sit below the status bar in portrait and landscape. The review modal already uses the sheet layout; loading rows do not introduce a second scroll container that ignores `safe-area-inset-bottom`.

`ScanSessionProvider` is mounted for both distributions. Android’s missing service worker is an advantage here: nothing outside the page unregisters the recognition worker while a scan is in flight.

## What this plan does not change

- Match math, `orbCandidates`, thresholds, OCR behavior, and the benchmark gate.
- Worker-pool size, including `isAndroidDistribution()` staying at 1.
- Soft cancel must not call `worker.terminate()`.
- IndexedDB shape, backup format, and partial-versus-complete merge rules.
- The capture step’s file checks and duplicate-page warning.
- Android permissions, the packaged asset set, and the offline WebView origin. Swiping the app away is the same end as a refresh. The plan does not add a persisted job queue, a system notification, or a foreground service.

## Files

| File | Change |
|---|---|
| `src/storage/recognition/protocol.ts` | Add the `slot` response. |
| `src/storage/recognition/worker.ts` | Post each outcome immediately. On cancel, post completed results, then `cancelled`. |
| `src/storage/recognition/scanWorkerPool.ts` | `onSlot`. Cancel resolves with the partial map. |
| `src/storage/scanSession.tsx` | New provider: phase, rows, decisions, skip set, toast, reviewOpen. |
| `src/main.tsx` | Mount the provider inside `StorageProvider`, around `App`. |
| `src/storage/ScanFlow.tsx` | Start and resume a session. Remove cancel-on-unmount. |
| `src/storage/ScanReview.tsx` | Render loading rows from the session. Gate save. Add “Scan remaining”. |
| `src/storage/ChestDetail.tsx` | If a session exists for this chest, open the review instead of the idle chest actions only. |
| `src/App.tsx` | Header status and toast. |
| `src/styles.css` | Loading row, `scaleX` bar, toast, reduced motion. |
| `tests/scan-session.test.ts` | New. Skip rules, cancel retention, toast suppression. Pure functions, no worker. |
| `tests/storage-recognition.test.ts` | Only if a pool test already lives here; otherwise leave recognition tests alone. |

`ScanReview` should take the session (or the row slice plus actions) rather than a finished `pageResults` array. The current prop shape assumes every slot is done before the first render.

## Implementation order

1. **Stream results.** Protocol, worker, pool. A unit test around the pool can fake a worker message sequence: three `slot` messages, then `cancelled`, and assert the partial map contains those three. Do this before any UI, so the review is not built on a batch-only API.
2. **Pure session rules.** Skip set, “which rows survive cancel”, “should a toast show given `reviewOpen` and phase”. Test these without React.
3. **Provider and review UI.** Wire start, live rows, bar, confirm-cancel, save gating, and “Scan remaining” while staying on the chest. Navigation still unmounts the view in this step only if the provider already ignores unmount; do not ship step 3 with the old cleanup still calling `cancelScan`.
4. **Background and toast.** Header status, route change leaves the session running, return to the chest reopens the review, deletion toast, one-scan guard.
5. **Motion.** Loading pulse, icon fade, reduced motion. After the states exist, so the animation is a class on a row that already resolves.

## Verification

Automated:

- Skip set: matched slot skipped; accept and ignore skipped; unresolved without a manual decision re-queued; unresolved after Identify skipped; unfinished slot re-queued; a new hash on page 2 drops only page 2.
- Cancel retention: rows with outcomes remain, loading rows are removed, phase is `stopped`, chest save functions are not called.
- Toast: `reviewOpen === true` at the ready transition produces no toast; `reviewOpen === false` produces one ready toast; a later dismiss leaves the session; chest removal produces the deleted toast and a null session.
- Pool message fixture: `slot` updates are visible before the terminal message; cancel keeps those outcomes.
- Existing storage repository tests for `withPartialScanMerged` and `withCompleteScanReplaced` still pass. This plan does not change those functions.

Manual, on a desktop width and a phone width:

- Scan one page. The review shell appears before any icon. Rows then appear together with thumbnails. Icons fill in place. Order matches slot order.
- Stop halfway. The confirm copy matches this plan. Resolved rows remain and can be merged. Loading rows are gone. The chest is unchanged until Merge.
- From the stopped review, Scan remaining. Previously matched slots are not matched again. A slot the player ignored stays ignored.
- Replace one page’s screenshot. That page’s rows clear. The other page’s resolved rows stay.
- Start a scan, open Pokédex, wait. The header status stays. The ready toast appears on Pokédex. Tap it and land on the review with every row resolved. Merge still requires a click.
- Start a scan, open the same chest from Storage before it finishes. The live review is there, including any Replace already done.
- Start a scan and try Import on a second chest. A second job does not start.
- Delete the chest while a scan runs. The toast says it stopped, and no review is left behind.
- Reload during a scan. The session is gone and the chest is unchanged.
- `prefers-reduced-motion`: rows still resolve to icons, without the pulse.
- A Big storage box with one page uploaded still merges, and Replace stays hidden. All three pages still offer Replace, including after a stop, saving only the rows that remain.

Android, on an emulator or a device running the `android` distribution (pool size 1, airplane mode, no network):

- The same in-app checks as above: live rows, stop, scan remaining, section change, toast tap, second chest blocked, chest delete, reduced motion.
- System Back from the confirm dialog, from the review, and from the chest. Each step leaves the scan running and leaves the chest unsaved.
- Home during matching, then return. If the process is still alive, the scan has continued or the in-app toast is visible. No system notification appears.
- Swipe the app away during a scan, then reopen. The session is gone and the chest is unchanged.
- Pick a screenshot through the system picker. No camera or storage permission prompt.

## Out of scope

- Persisting the scan across reload or Android process death, or a service-worker job.
- An Android system notification or foreground service so a scan can finish after the player has left the app.
- A `beforeunload` warning, or a warning when Android moves the app to the background.
- Auto-save when the toast appears or when the player navigates away.
- Skipping slots because the chest already contains that catalog item.
- Showing empty slots as rows.
- Changing pool size, ORB candidate counts, or the prepare pipeline’s threading. If the “Reading the page…” stretch needs to get off the main thread later, that is a follow-up to `prepareScanSlots`, not part of this UI.
