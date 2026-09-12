# Cloud progress sync plan

Date: 2026-09-12

[Certain] Status: discussion captured as a plan; implementation and provider selection are not approved. This document does not change application behavior.

## Goal

[Certain] The requested experience is email-based sign-in, cloud-backed progress across desktop and mobile, version tracking, and a prompt when another device has newer progress available.

[Likely] Recommended direction: keep immediate local saving and offline use, then add optional account sync. Automatically upload local changes when safe; ask before applying incoming cloud progress. Treat this as the proposed default until the open decisions below are settled.

## Current foundation

[Certain] `src/persistence/store.ts` currently stores a `SaveState` in IndexedDB through Dexie under the `main` record. It includes found Pokémon, crafting progress and recovery payloads, habitat builds, shopping data, plans, unlocked kits, and collected items. Its top-level `schemaVersion` is 1; this is a data-format version, not a cloud revision.

[Likely] Sync should cover persistent notebook progress and preserve existing migration/recovery data. Keep transient navigation, filters, scroll positions, and device preferences local unless explicitly added to scope later. Recheck the actual save model before implementation.

## Proposed user experience

[Likely] Initial setup:

1. Keep guest/local use available.
2. Offer “Sign in to sync progress” using a verified email login.
3. If the account has no cloud save, offer to upload this device's notebook.
4. If the account already has progress and the device is empty, offer to load it.
5. If both contain progress, show a comparison before importing or replacing anything. Unrelated first-time saves have no shared revision and must not be treated as an ordinary incremental sync.

[Likely] Desktop-to-mobile flow:

1. Desktop changes save locally immediately.
2. Upload a batch of changes when online and the known cloud revision still matches.
3. Mobile checks the cloud when opened, brought to the foreground, or reconnected.
4. Show an in-app banner, for example: “New progress from Desktop — 3 Pokémon marked found, 2 recipes learned.” Derive the summary from actual differences.
5. Offer “Review changes,” “Use cloud progress” when there are no pending local edits, and “Later.”
6. Preserve a recovery copy and validate the incoming save before applying it.

[Likely] Use an in-app notification for this flow; browser push notifications are outside the initial scope.

## Sync states and rules

[Likely] Proposed behavior:

| State | Behavior |
| --- | --- |
| Signed out | Save locally; cloud sync is inactive. |
| Local and cloud unchanged | Show “Up to date.” |
| Only local changed | Upload automatically when connected. |
| Only cloud changed | Offer incoming update; do not apply before acceptance. |
| Both changed | Reconcile against the last shared save; review conflicts before publishing. |
| Offline | Save locally and show “Changes waiting to sync.” |
| Upload failed | Retain pending edits; retry with backoff and expose retry status. |
| Login expired | Continue local saving; ask the user to sign in again to resume sync. |
| Incoming format unsupported | Preserve local progress; request an app update rather than guessing how to read the save. |

[Likely] “Later” must pause uploads from the stale device too. Further local edits remain pending until the incoming revision is reconciled. Keep a visible “Update available” state without repeatedly interrupting the user for the same revision.

[Likely] Show “Synced” only after server acknowledgement. Distinguish “Saved on this device,” “Syncing,” “Up to date,” “Update available,” and “Needs review.”

## Version model and write safety

[Likely] Keep these concepts separate:

| Field or concept | Purpose |
| --- | --- |
| `schemaVersion` | Defines the readable save format and migration requirements. |
| Cloud revision | Monotonic, server-controlled accepted-save sequence. |
| Base revision | Last shared cloud revision from which this device edited. |
| Base snapshot | Supports comparison of local and remote changes against their common starting point. |
| Local change generation | Detects edits made while an upload or review is in progress. |
| Commit ID | Makes retries idempotent when an upload acknowledgement is lost. |
| Server timestamp and device label | Explain when and where an accepted revision originated. |

[Likely] Do not use device clocks or timestamps to select the winning save. Accept a commit only if its base revision matches the current cloud head, using an atomic transaction or equivalent server check. On mismatch, fetch and reconcile again; never silently retry the stale full save as a new overwrite.

[Likely] Persist pending edits and sync metadata locally so refreshes and crashes do not discard work. Acknowledging one upload must not mark edits made afterward as uploaded. Serialize competing sync attempts across browser tabs or make them safe through the same revision checks.

[Likely] Separate incoming remote data from the active notebook until accepted. Do not let a database listener mutate the user's local save automatically. If the cloud changes while a review is open, revalidate the revision before committing the reviewed result.

## Conflict policy

[Likely] Use a three-way comparison: shared base, current local state, and current cloud state. Combine independent edits; request a choice for incompatible changes to the same logical record or field.

[Likely] Examples:

- Desktop marks a Pokémon found; mobile learns a recipe: preserve both changes.
- Two devices make the same edit: retain one resulting value.
- One device intentionally unchecks a mark: preserve that removal when the other device did not change it; do not union all checked IDs.
- Both devices change residents in the same home differently: show a conflict for that home.
- One device deletes a record while the other edits it: ask whether to keep the edited record or the deletion.
- Quantity and allocation changes: do not add numbers automatically; compare intent and validate resulting invariants.

[Likely] Start with conservative conflict boundaries for connected housemate, habitat, and allocation records. Validate the complete merged notebook before saving. The exact per-domain merge rules need an implementation-time audit; do not promise automatic merging of every field.

## Recovery and account boundaries

[Likely] Preserve a recovery snapshot before replacing local progress or resolving a conflict. Keep manual export/import available. A recovery snapshot must not be silently stripped by migrations or validation.

[Likely] Cloud revision tracking alone is not version history. Retaining historical snapshots, how long to retain them, and whether users can browse and restore them are separate product decisions. A restore should create a new revision through the normal conflict checks rather than rewind the revision counter.

[Likely] Scope local account saves and pending queues by stable account ID. On sign-out or account switching, stop the previous account's sync and keep its data isolated. Never upload account A's local notebook to account B automatically. Specify guest-save adoption and local-data retention in the account UI before implementation.

## Provider direction

[Likely] Firebase Authentication plus Cloud Firestore is the initial candidate, not a final commitment. Preserve a provider boundary around authentication, reading revisions, submitting conditional commits, and retrieving recovery snapshots.

[Certain] Firebase supports email-link authentication that verifies email ownership. Firestore supports transactions, but client transactions fail while offline. Firestore's automatic offline synchronization uses last-write-wins for multiple changes to the same document; it does not implement this plan's review and conflict policy.

[Likely] Keep IndexedDB as the app's durable local store and explicitly coordinate cloud commits when connected. Use stable authenticated user IDs for ownership, rather than email addresses as storage keys. Enforce per-account access and valid revision transitions on the server or through tested security rules; client checks alone are insufficient.

[Likely] Before choosing the storage layout, measure realistic and worst-case notebook sizes, including preserved legacy payloads. Verify current document limits, authentication email quotas, read/write costs, history retention costs, and hosting requirements. Do not assume the service will remain free for the expected usage.

## Implementation phases after approval

[Likely] Proposed sequence:

1. Resolve the product decisions below and audit current save, migration, import, and reset behavior.
2. Define account-scoped local storage, durable pending changes, revision metadata, and merge boundaries.
3. Add authentication and server-enforced per-account access; test isolation before enabling uploads.
4. Implement conditional, idempotent cloud commits and download staging without automatic notebook replacement.
5. Add status UI, incoming-update review, conflict handling, and recovery snapshots.
6. Validate on real desktop and mobile browser sessions, then roll out as opt-in sync.

## Acceptance checks

[Likely] Required validation before release:

- Desktop edits appear on mobile after accepting the incoming update and survive reload.
- Choosing “Later” preserves both versions and prevents stale uploads.
- Independent offline edits on both devices survive reconciliation.
- Conflicting edits, deletions, and unchecking are surfaced or merged according to explicit domain rules.
- Simultaneous uploads cannot overwrite an intervening cloud revision.
- Lost acknowledgements and retries do not create duplicate accepted commits.
- Edits made during upload or review remain pending or trigger a fresh comparison.
- Refresh, browser restart, disconnection, and expired login preserve pending local work.
- Account switching never exposes or uploads another account's notebook.
- First login with existing local and cloud progress requires an explicit import/reconciliation choice.
- Unsupported or malformed remote saves do not replace working local progress.
- Recovery restores create a new revision and preserve the pre-restore state.
- Existing local-only use, backup import/export, and migrations continue working.

## Open decisions

[Likely] Recommended defaults are proposals, not settled requirements:

| Decision | Recommended starting point |
| --- | --- |
| Ask before every incoming cloud update? | Yes, matching the requested mobile prompt; consider an optional automatic mode later. |
| Upload local changes automatically? | Yes, only when there is no unresolved incoming revision. |
| Email login method? | Email-link sign-in; confirm before implementing. |
| Expose version history to users? | Guarantee recovery protection first; decide restore UI and retention before launch. |
| Merge granularity? | Independent simple marks automatically; conservative review for connected plans and quantities. |
| Provider? | Evaluate Firebase against measured payloads, costs, and operating requirements. |
| Sign-out local-data behavior? | Keep account data isolated; explicitly decide whether to retain or remove the local copy. |

## Sources checked during discussion

[Certain] Official references consulted on 2026-09-12:

- [Firebase email-link authentication](https://firebase.google.com/docs/auth/web/email-link-auth)
- [Firestore offline behavior](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore security-rule conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)

[Likely] Recheck provider behavior, quotas, limits, and costs when implementing.
