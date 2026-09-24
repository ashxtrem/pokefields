# pokefields — Capacitor Android and Google Play release plan

**Status:** approved technical plan; implementation is in progress.

## Implementation progress

### 2026-09-23 — Phases 1–3 web payload and native foundation implemented

- Added a validated `web`/`android` distribution contract around `VITE_DISTRIBUTION`.
- Kept the default and `npm run build` behaviour on the existing web distribution.
- Added `npm run build:android:web`, which emits `dist-android/` without generating `sw.js`.
- Gated service-worker registration to the web distribution.
- Added automated tests for accepted and rejected distribution values.
- Verified 260 tests, TypeScript, the Android-mode web build, the unchanged web build, Android service-worker absence, and web service-worker generation.
- Rechecked Google Play's target API policy: since 31 August 2026, new apps and app updates must target Android 16 / API 36 or higher.
- Locked the Android release contract: `com.atcodepathi.pokopiafieldnotes`, `AT.CodePathi`, `pokefields`, version `1.0.0` / code `1`, minimum API 24, target/compile API 36, and portrait plus landscape support.
- Locked `ashxtrem+pokefields@gmail.com` as the public support and privacy contact.
- Locked the Play developer account type as **personal**. Account creation date, identity-verification status, and Android-device verification remain unconfirmed; these determine the exact production-access gates.
- Added and deployed standalone static `/privacy` and `/support` pages on the dedicated `pokefields-privacy.pages.dev` Cloudflare Pages project; both canonical HTTPS routes were verified on 2026-09-23.
- Added `https://pokefields-privacy.pages.dev/privacy` to the in-app **About & Legal** section; Capacitor Browser opens it outside the offline Android WebView and outside the app site's service-worker origin.
- Replaced the browser-only Blob download on Android with a native backup-export adapter: it writes the JSON backup to the app cache and opens Android's share/save sheet through Capacitor Filesystem and Share. The web download path is unchanged, export is guarded against repeat taps, and failures are shown in the notebook UI. Automated adapter coverage and APK packaging pass; representative-device export remains an open runtime gate.
- Replaced the generated Capacitor launcher artwork with the existing Fieldnotes leaf mark across legacy, round, adaptive, and Android 13 themed icon resources; the reproducible branding step runs before every Android sync.
- Exempted `/privacy` and `/support` from the web app-shell navigation fallback and precached their directory-index pages, so an installed service worker cannot replace either legal page with the app UI.
- Added a strict Android asset gate that decodes and hashes 2,787 inputs, rejects missing and unexpected controlled assets, validates recognition shards, and writes gitignored release reports and a release-input manifest.
- Recorded `coppeingot` and `gold` as explicit text-fallback exceptions because their distinct upstream icon URLs return 404; the verifier reports zero unexplained asset issues.
- Added a derived Android catalog that removes provenance and remote URLs while preserving the web catalog unchanged.
- Packaged the Tesseract worker, four runtime cores, and English recognition model locally; Android OCR uses explicit same-origin paths.
- Added an Android-only CSP, removed Android source/help links, and added a final-output scanner. The current scan verifies 2,795 output files, zero unexplained URLs, no service worker, and no leaked provenance.
- Generated the Capacitor 8 Android project with application ID `com.atcodepathi.pokopiafieldnotes`, version `1.0.0` / code `1`, min/compile/target API `24/36/36`, automatic cloud backup disabled, cleartext traffic disabled, and no `INTERNET` permission in the app manifest.
- Installed the stable API 36 SDK platform/build tools and compiled a 173 MB debug APK. Its merged manifest and packaged assets were inspected after build; the APK contains the stripped catalog, native export implementation, and complete local OCR runtime, and contains none of `sw.js`, `_redirects`, or the source-image manifest.
- Corrected an APK-only OCR defect found during inspection: Android's asset packager decompressed and renamed the gzipped English model, so the release pipeline now prepares `eng.traineddata` explicitly and configures Tesseract with `gzip: false`.

The web payload is now separated and guarded for Android packaging. Physical-device offline validation, native lifecycle and document-import validation/adapters, release signing, store assets, and Play declarations remain required before release.

**Current blockers:** Play account creation date, identity-verification status, and Android-device verification are not confirmed, and upload-key ownership is not assigned. The Gradle wrapper exposed a host proxy/trust-store certificate failure; native compilation passed with the installed Gradle 8.13 and Android Studio Java 21, but the wrapper/download path must be repaired for reproducible CI. Existing emulator definitions are stale, so airplane-mode runtime validation still requires a working emulator or physical device.

**Primary outcome:** package the existing React/Vite application as a Capacitor Android app whose complete catalog, artwork, sprites, item images, habitat images, specialty images, recognition data, and core functionality are available from the first launch without a network connection.

## Locked product decisions

- Use Capacitor 8 with a generated, version-controlled `android/` project.
- Keep the shared React/Vite codebase for web and Android.
- Package the current baked asset set into the Android application. The Android build must never download catalog or image assets at runtime.
- Remove external source URLs, source labels, retrieval dates, and remote image URLs from the Android runtime catalog and Android UI.
- Retain a private build-time provenance and hash manifest outside the distributable, plus any notices that must accompany redistributed software dependencies.
- Keep progress, plans, storage chests, captured images, and settings local to the device. No account, cloud sync, analytics, advertising, crash-reporting SDK, or remote database is part of Android v1.
- Provide local JSON backup export and import.
- Publish a public privacy-policy URL for Google Play and package an offline copy inside the app.
- Display the non-affiliation notice in the in-app About & Legal screen and store listing. Include a shorter identification statement in the privacy policy.
- A successful Play Store install may require connectivity; after installation, the application itself must be fully functional in airplane mode from its first launch.

## Definition of done

Android v1 is complete only when all of the following are true:

1. A signed release AAB is generated from a clean checkout without downloading catalog data or images during the signing build.
2. A fresh installation launched in airplane mode can browse every catalog section, display every packaged image, use planning and storage tools, run screenshot recognition, and save progress.
3. There are no runtime requests to PokeAPI, Serebii, PokopiaAPI, Cloudflare, Google services, or any other external host.
4. The Android runtime catalog contains no external source URLs, remote image URLs, source-provider labels, or retrieval timestamps.
5. Local data survives force-stop, process death, device restart, orientation change, and an in-place app update.
6. JSON export and import work through Android's document/share flows without broad storage permission.
7. Android Back, external-link handling, safe areas, status bar, keyboard, large text, and accessibility have been validated on physical devices.
8. The privacy policy, Data safety declaration, permissions, and observed binary behaviour agree.
9. The exact AAB uploaded to Play has passed internal testing, closed testing, and the release checklist in this document.

## Verified repository baseline

| Area                  | Current repository state                                                                           | Android implication                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Web stack             | React 19, TypeScript, Vite 6, Node 22                                                              | Compatible with Capacitor's bundled-web-assets model.                                                                         |
| Native project        | No `android/` directory or Capacitor configuration                                                 | Native bootstrap is still required.                                                                                           |
| Build output          | Existing `dist/` is approximately 202 MB across 2,783 files                                        | Measure compressed device download after the first AAB; size optimisation is part of the release gate.                        |
| Catalog               | `public/data/catalog.json` is approximately 2.9 MB                                                 | Generate a separate Android runtime catalog rather than modifying the research/source catalog.                                |
| Baked images          | 2,764 image files, approximately 126 MB in `public/images/`                                        | Copy and verify all images before `cap sync`; do not rely on lazy caching.                                                    |
| Image groups          | 714 Pokémon files, 252 habitat files, 1,765 item files, 32 specialty files                         | Record expected counts and hashes in the release-input manifest.                                                              |
| Recognition data      | Generated storage reference index is approximately 44 MB in the current `dist/data/`               | Must be packaged and tested on low-memory devices; consider a compact binary format if size or startup memory fails its gate. |
| Persistence           | Dexie/IndexedDB database `pokopia-fieldnotes`; separate state, chest, local-item, and image tables | Preserve IndexedDB for v1 and validate WebView persistence before considering a native database migration.                    |
| Backup                | Native Android cache-file export/share plus browser download and validated JSON import             | Validate export/share and the WebView document-picker import on representative devices; add an import bridge only if needed.  |
| Offline web behaviour | Service worker precaches the shell but lazy-caches images                                          | Disable the service worker in Android; packaged files, not a runtime cache, are the Android offline contract.                 |
| External links        | Sources in About and recipe views; two help links in Storage Guide                                 | Remove source links from Android and package any required help content locally.                                               |

## Target architecture

```text
Canonical research inputs
  public/data/catalog.json
  public/images/**
  generated recognition index
             |
             v
Android release preparation (network disabled)
  verify every expected file and hash
  create stripped runtime catalog
  copy all local assets to dist-android/
  generate release-input manifest outside dist-android/
             |
             v
Vite Android build: dist-android/
  index.html + JS/CSS/workers
  data/catalog.json
  data/storage-reference-index.*
  images/**
  legal/privacy.html
  legal/notices.html
             |
             v
Capacitor sync -> android/app/src/main/assets/public/
             |
             v
Signed AAB -> Play internal -> closed -> production
```

The web build continues to use `dist/`. Android uses `dist-android/` so platform-specific stripping and offline rules cannot accidentally change the deployed web application.

## Phase 0 — lock permanent release identity

**Required decisions before `npx cap add android`:**

- Permanent application ID, for example `com.<owned-namespace>.pokopiafieldnotes`. Do not generate the Android project with a temporary ID.
- Play developer display name and legal developer identity.
- Android display name: `pokefields`.
- Public privacy-policy URL, support email, and support URL.
- Initial version name and monotonically increasing version code.
- Supported orientation. Recommendation: allow portrait and landscape unless physical-device testing finds an unusable layout.
- Minimum Android version. Recommendation: API 24, matching Capacitor 8's documented Android minimum; confirm actual device coverage before locking it.
- Target and compile SDK: API 36 for the current 2026 Play submission requirement; recheck on every submission.

**Deliverable:** `docs/android-release-contract.md` containing the selected values. Package ID and signing ownership become change-controlled after the first uploaded AAB.

## Phase 1 — introduce explicit distribution builds

### 1.1 Add a distribution contract

Create `src/platform/distribution.ts` around `VITE_DISTRIBUTION`:

- `web`: existing Cloudflare/PWA behaviour.
- `android`: bundled assets, no service-worker registration, no runtime source links, and native file/lifecycle adapters.
- Reject unknown values during build rather than silently falling back.

Add `.env.android` with `VITE_DISTRIBUTION=android`; it must contain no secrets.

### 1.2 Separate web and Android outputs

Configure Vite to emit:

- `dist/` for `npm run build:web`.
- `dist-android/` for `npm run build:android:web`.

Keep `npm run build` mapped to the existing web build until Android CI is stable. Add explicit scripts:

```json
{
  "build:web": "...",
  "assets:verify:android": "node scripts/verify-android-assets.mjs",
  "catalog:android": "node scripts/build-android-catalog.mjs",
  "build:android:web": "...",
  "cap:sync:android": "npm run build:android:web && npx cap sync android",
  "android:open": "npx cap open android",
  "android:run": "npm run cap:sync:android && npx cap run android"
}
```

The concrete commands should run TypeScript checks, tests, asset verification, Android catalog generation, storage-reference generation, and Vite compilation in that order.

### 1.3 Disable PWA caching inside Android

- Gate the `navigator.serviceWorker.register('/sw.js')` call in `src/main.tsx` to the `web` distribution.
- Do not generate or copy `sw.js` into `dist-android/`.
- On Android, all files are read directly from Capacitor's packaged local origin.
- Add an upgrade test proving a new APK/AAB immediately serves its new catalog and UI rather than an older service-worker cache.

**Exit gate:** both platform builds compile, the web build behaves as before, and the Android web output contains no service worker.

## Phase 2 — freeze and package the complete asset set

### 2.1 Split acquisition from release packaging

The present `npm run build` calls `scripts/bake-images.mjs`, which may download missing files. Android signing must not do that.

Create two distinct workflows:

1. **Asset refresh workflow:** intentionally run import and bake scripts with network access, review changes, and produce a new approved asset snapshot.
2. **Android release workflow:** run with network access disabled and fail if any approved file is absent, changed unexpectedly, empty, corrupt, or referenced by the catalog without a packaged counterpart.

### 2.2 Create an immutable release-input manifest

Generate a private CI/release artifact containing:

- App source commit.
- Node version and lockfile SHA-256.
- Catalog version and full catalog SHA-256.
- Every packaged asset's relative path, byte size, media type, dimensions where applicable, and SHA-256.
- Expected counts by Pokémon artwork, sprite, habitat, item, specialty, guide asset, and recognition-data group.
- Provenance retained for internal traceability but not copied into `dist-android/`.
- Generator version and generation timestamp.

Store this in an access-controlled release archive or a gitignored `.release-private/` workspace. The AAB should receive only a non-identifying content/version hash needed for diagnostics.

### 2.3 Build the Android runtime catalog

Create `scripts/build-android-catalog.mjs` that reads the canonical catalog and writes a derived catalog only to `dist-android/data/catalog.json`.

For Android output:

- Remove `source`, `sources`, `additionalSources`, `sourceUrl`, `provider`, `retrievedAt`, remote `image`, and remote `iconUrl` fields where they exist only for provenance or outbound linking.
- Preserve all fields required by filtering, detail pages, habitats, planning, recipes, materials, storage matching, and migrations.
- Convert display image selection to stable local asset identifiers or paths.
- Do not modify `public/data/catalog.json`; it remains the canonical research input.
- Fail if application code tries to read a removed field in Android mode.
- Snapshot-test the stripped schema so new provenance fields cannot leak into future Android builds.

### 2.4 Verify completeness

`scripts/verify-android-assets.mjs` must:

- Calculate the complete required-file set from the canonical catalog.
- Verify both primary Pokémon artwork and compact sprite coverage where the UI can request either.
- Verify habitat, item, specialty, Storage Guide, favicon/app-shell, worker, and recognition-index assets.
- Decode images to catch corrupt files rather than checking file size alone.
- Reject remote fallbacks.
- Reject unexpected files not listed in the approved snapshot.
- Emit a machine-readable verification report for CI.

### 2.5 Control package size

The current uncompressed `dist/` is approximately 202 MB, including about 139 MB of images, 47 MB of data, and a 15 MB recognition worker.

- Record AAB size and Play's per-device compressed download estimate for every candidate.
- Target a compressed download below 200 MB even though current Play delivery supports larger apps; crossing 200 MB introduces an install warning and can reduce install completion.
- Optimise PNGs losslessly first. Do not resize images below the detail-view acceptance threshold.
- Investigate compacting the 44 MB JSON recognition index before moving assets into Play Asset Delivery.
- Keep all required assets install-time. Fast-follow and on-demand asset packs violate the first-launch offline requirement.

**Exit gate:** a clean, network-disabled Android web build produces a complete `dist-android/`, and the asset report has zero missing, corrupt, remote, or unexpected files.

## Phase 3 — make runtime behaviour fully offline

### 3.1 Eliminate runtime network dependencies

- Load `/data/catalog.json`, image paths, workers, WASM, fonts, and recognition data only from the packaged local origin.
- Remove Android source-link rendering from `RecipeDetail` and About.
- Replace the two online Storage Guide links with packaged instructions or omit those optional sections on Android.
- Do not use remote fonts, remote CSS, CDN scripts, remotely hosted configuration, update checks, or live content feeds.
- Keep privacy/support links out of the WebView. If retained as optional actions, open them explicitly in the system browser and never make them necessary for a feature.

### 3.2 Add an Android Content Security Policy

Generate an Android-specific CSP approximately equivalent to:

```text
default-src 'self';
connect-src 'self';
img-src 'self' data: blob:;
media-src 'self' blob:;
worker-src 'self' blob:;
font-src 'self';
object-src 'none';
base-uri 'self';
```

Adjust `script-src` and `style-src` only as required by the compiled Vite output. `connect-src 'self'` is required for packaged catalog, recognition-index, and OCR-model reads through Capacitor's local origin; do not add external origins in production.

### 3.3 Add build-time URL scanning

After building `dist-android/`:

- Scan HTML, JS, CSS, JSON, manifests, and worker files for `http://`, `https://`, protocol-relative URLs, and known remote hostnames.
- Maintain a very small allowlist only for inert standards identifiers if the bundler emits them.
- Fail CI for any runtime-capable remote endpoint.
- Produce the scan report alongside the release manifest.

### 3.4 Prove offline operation

Required tests on a fresh installation:

1. Install the candidate, enable airplane mode before first launch, and clear app storage.
2. Launch and navigate through Pokédex, Habitats, Items, Crafting, Planner, Housemates, Storage, and every modal.
3. Confirm representative artwork from every asset group.
4. Run storage screenshot recognition using a locally selected screenshot.
5. Create progress, layouts, habitat locations, chests, local items, and captured images.
6. Force-stop, relaunch, reboot the device, and repeat key reads.
7. Capture traffic through a test proxy and Android network diagnostics; expected external requests: zero.

**Exit gate:** every core scenario passes in airplane mode on first launch, and the traffic report contains zero external requests.

## Phase 4 — add Capacitor Android

### 4.1 Pin dependencies

At planning time, npm reports Capacitor core/CLI/Android `8.5.2`, App `8.1.1`, Filesystem `8.1.3`, and Share `8.0.2`. Recheck immediately before implementation, then pin exact compatible versions in the lockfile.

Install only the required packages:

```text
@capacitor/core
@capacitor/cli
@capacitor/android
@capacitor/app
@capacitor/filesystem
@capacitor/share
```

Do not add analytics, remote configuration, advertising, authentication, or crash-reporting SDKs for v1.

### 4.2 Configure Capacitor

Create `capacitor.config.ts` with:

- Final `appId` from Phase 0.
- `appName: 'pokefields'`.
- `webDir: 'dist-android'`.
- No `server.url` and no live-reload address in committed production configuration.
- A local HTTPS scheme where supported.
- A narrow navigation allowlist; remote pages must not load inside the app WebView.

Run `npx cap add android` once, review the generated project, and commit `android/` so Gradle, manifest, resources, and native changes are versioned.

### 4.3 Android project settings

- Set `compileSdk` and `targetSdk` to 36 or the newer submission requirement.
- Set `minSdk` to 24 unless Phase 0 chooses a higher floor.
- Lock JDK, Gradle, Android Gradle Plugin, Kotlin, and Capacitor versions in developer setup and CI.
- Configure adaptive launcher icon, monochrome icon, splash screen, status/navigation bar colours, and app theme using original Fieldnotes branding.
- Support edge-to-edge layouts and CSS safe-area insets.
- Disable cleartext traffic.
- Request no camera, location, contacts, microphone, notification, broad storage, or media-library permission.
- Audit the merged release manifest because plugins can contribute permissions transitively.

### 4.4 Signing and App Bundle

- Generate an upload key in an access-controlled secret store; never commit it or its passwords.
- Document recovery ownership and backup location.
- Enable Play App Signing.
- Configure release signing through CI secrets or a protected local properties file.
- Generate `bundleRelease` and retain the AAB SHA-256, version code, version name, source commit, asset-manifest hash, and build log.

**Exit gate:** a debug APK installs successfully, a signed release AAB builds reproducibly, and the merged manifest has only reviewed permissions and components.

## Phase 5 — native lifecycle, Back, files, and persistence

### 5.1 Platform adapter

Create a narrow interface under `src/platform/` so React features do not import Capacitor APIs throughout the component tree:

- `isAndroidApp()`.
- `onPause`, `onResume`, and `onBackButton`.
- `exportBackup(contents, filename)`.
- `chooseBackupFile()`.
- `openExternalUrl(url)` for the few explicitly approved optional external actions.
- `getAppVersion()`.

The web implementation retains current browser behaviour; the Android implementation uses Capacitor/native behaviour.

### 5.2 Android Back contract

Use `@capacitor/app` and test this order:

1. Close the topmost modal or lightbox (for example, the habitat region picker, then an open habitat location row editor).
2. Leave an edit/review flow after handling unsaved state — an open location row editor with an unsaved note asks before discarding.
3. Navigate from detail to its previous in-app route.
4. Navigate through WebView history when appropriate.
5. At a root section, require a second Back press within a short interval to exit, or minimise according to the final UX decision.

Do not allow Back to discard an import review, edited chest, captured image, or unresolved scan without warning.

### 5.3 Lifecycle and persistence

- Keep Dexie/IndexedDB as the v1 source of truth.
- Track pending writes and flush/wait when the app is paused or backgrounded.
- Reopen state cleanly after Android kills the WebView process.
- Do not clear or rename the WebView origin across updates; that would make the existing IndexedDB appear lost.
- Test upgrade from at least one earlier signed build containing representative state and stored image blobs.
- Keep JSON backup as the user-controlled recovery path; uninstalling or clearing app storage removes local data.

### 5.4 Backup export and import

- Preserve the current validated backup-envelope format.
- On Android export, write the JSON to cache/documents through `@capacitor/filesystem`, invoke the system share sheet with `@capacitor/share`, and delete temporary exports after a bounded retention period.
- For import, first validate the WebView file input with Android's system document picker. If device coverage is unreliable, add a minimal Kotlin `OpenDocument` bridge rather than broad storage permission.
- Accept only JSON, enforce the existing maximum byte limit before parsing, validate completely before writing, and retain the current confirmation screen.
- Test large backups containing storage photographs and unresolved screenshot slots.

**Exit gate:** lifecycle, Back, export, import, process-death, and signed-update tests pass without data loss or unnecessary permissions.

## Phase 6 — privacy, About & Legal, and Play declarations

### 6.1 Public and offline privacy policy

Create one canonical privacy-policy source and publish it in two forms:

- Public HTTPS page used by the Play listing.
- Packaged offline page or native route accessible from Settings/About without connectivity.

The policy must accurately describe:

- Developer identity, app name, effective date, and support contact.
- No account creation.
- No analytics, advertising, telemetry, crash-reporting service, cloud sync, or developer-operated backend in v1.
- Progress, plans, preferences, chests, uploaded/captured screenshots, thumbnails, and recognition results are stored locally on the device.
- The user initiates backup export and chooses where or with whom the Android share sheet sends it; the app does not receive or control the destination service's practices.
- Import reads only the file the user selects.
- Uninstalling or clearing app storage deletes locally stored data unless the user exported a backup.
- The app requests no broad photo/media-library permission and uses the system picker for user-selected files.
- Support contact may process information the user voluntarily includes in an email.
- Policy-change and contact process.

Include this short identification statement near the end:

> pokefields is an unofficial fan-made companion and is not affiliated with, endorsed by, or sponsored by Nintendo, Creatures Inc., GAME FREAK inc., or The Pokémon Company.

Do not use the privacy policy as the only location for that notice.

### 6.2 In-app About & Legal screen

Add an offline screen containing:

- App name, version name, version code, and build/content version.
- Developer identity and support email.
- Full non-affiliation statement.
- Trademark-owner acknowledgement using reviewed final wording.
- Link to the packaged privacy policy.
- Optional action to open the public privacy/support page in the system browser.
- Required open-source software notices, generated from the exact release dependency tree.

The Android screen must not include catalog source URLs or source-provider links. Required dependency notices must remain available offline.

### 6.3 Play Data safety and App content

For the locked v1 scope, prepare declarations based on the final binary audit:

- Data collected by developer: expected `No`.
- Data shared with third parties by developer: expected `No`.
- Accounts: none.
- Ads: none.
- Paid features/IAP: none.
- App access: no login; provide reviewer instructions for offline launch, backup, and screenshot import.
- Target audience and content rating: answer from the final product and listing, not from this plan.
- Permissions: reconcile Play declarations with the merged Android manifest.

Any later addition of analytics, crash reporting, ads, sign-in, cloud sync, remote content, notifications, payments, or new permissions invalidates these expected answers and requires a policy/declaration update before release.

**Exit gate:** the public policy is reachable, the identical material is available offline, the About screen contains the notice, and declarations match captured release-binary behaviour.

## Phase 7 — automated verification and CI

Create a dedicated Android release pipeline:

1. Check out the exact release tag.
2. Install the pinned Node 22 version and run `npm ci`.
3. Run formatting check, TypeScript build, and Vitest.
4. Run asset completeness, corruption, hash, and expected-count verification with network disabled.
5. Generate the stripped Android runtime catalog.
6. Generate the storage recognition index.
7. Build `dist-android/`.
8. Scan for remote URLs, source fields, remote fallbacks, source maps, debug flags, and secrets.
9. Run an HTTP-disabled local smoke test against `dist-android/`.
10. Run `npx cap sync android` and fail on uncommitted generated native changes.
11. Run Android unit tests, lint, and release bundle build.
12. Inspect the merged manifest and AAB contents.
13. Measure AAB and estimated per-device compressed download size.
14. Sign only from an approved release tag.
15. Archive reports, mapping files, AAB hash, release manifest, and test evidence.

Add a CI rule that rejects `server.url`, live-reload hosts, debuggable release builds, unexpected permissions, cleartext traffic, or any remote domain in the Android payload.

## Phase 8 — device and upgrade test matrix

Test at minimum:

- One API 24–28 physical device or the oldest practical supported physical device.
- One mid-range Android 13–15 physical device with constrained memory/storage.
- One Android 16 physical device.
- One small phone around 320–360 dp width.
- One large-screen device or tablet layout.
- Current emulator images for repeatable automated smoke tests.

| Area                 | Required cases                                                            | Pass condition                                                          |
| -------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Install              | Fresh Play/internal install; reinstall; update over previous signed build | No blank screen, asset error, or data loss.                             |
| First-launch offline | Clear data, enable airplane mode, launch                                  | Entire core app works with zero network.                                |
| Catalog/assets       | Representative and automated checks across every asset group              | No broken images or remote fallback.                                    |
| Navigation           | Every section, details, modals, deep hashes, Android Back                 | Predictable navigation; no accidental exit or discarded edits.          |
| Persistence          | Marks, layouts, crafting, habitat locations, chests, local items, images  | Survives backgrounding, force-stop, process death, restart, and update. |
| Backup               | Export, share/save, import, invalid file, oversized file, old-format file | Valid backups restore; invalid inputs cause no partial write.           |
| Recognition          | Multi-page screenshot import and unresolved-slot review                   | Completes offline without worker crash or excessive memory.             |
| Display              | Rotation, cutouts, edge-to-edge, 200% text, dark/light system settings    | Critical content remains readable and reachable.                        |
| Accessibility        | TalkBack order/labels, touch targets, keyboard/focus where applicable     | Core flows complete without inaccessible controls.                      |
| Performance          | Cold start, image-heavy lists, search, planner, recognition               | No ANR, crash, or sustained memory pressure beyond defined thresholds.  |
| Storage pressure     | Low free space, large user image set, large backup                        | Clear errors; no database corruption.                                   |
| Network              | Airplane mode and proxy capture                                           | Zero external runtime requests.                                         |

Record device, OS, WebView version, app version/code, AAB hash, tester, date, scenario, outcome, screenshots, logs, and linked defect for every run.

## Phase 9 — Play Console and rollout

1. Create the Play app using the permanent package ID and locked developer identity.
2. Complete personal-account identity, contact, and any required Android-device verification tasks.
3. Confirm the account creation date. If it is after 13 November 2023, plan for at least 12 testers continuously opted in to the closed test for at least 14 days, plus documented engagement/feedback and a production-access application.
4. Enable Play App Signing and upload the exact signed AAB from CI.
5. Complete store title, descriptions, category, contact details, privacy URL, screenshots, icon, feature graphic, audience, content rating, Data safety, ads, and app-access declarations.
6. Use screenshots taken from the exact Android release candidate; do not use web mockups.
7. Start with internal testing and inspect install size, generated APKs, pre-launch report, permissions, crashes, and accessibility findings.
8. Promote the unchanged artifact to closed testing after internal blockers are resolved.
9. Test fresh installs and updates through Play, not only Android Studio.
10. Collect structured tester evidence for offline first launch, persistence, backup, Android Back, and representative devices.
11. Submit the unchanged closed-test artifact to production using managed publishing and a staged rollout.
12. Stop rollout for crashes, ANRs, data loss, corrupt assets, manifest/declaration mismatch, or any unexpected runtime network request.

## Release checklist

### Identity and native project

- [x] Play developer account type locked as personal.
- [ ] Permanent application ID and developer identity locked.
- [x] Capacitor and plugins pinned to compatible exact versions.
- [ ] `android/` generated, reviewed, and version-controlled.
- [x] `minSdk`, `compileSdk`, and `targetSdk` documented and current.
- [ ] Original launcher, adaptive, monochrome, and splash assets installed.
- [ ] Upload key protected and Play App Signing configured.
- [ ] Personal-account creation date and applicable closed-testing requirement confirmed.
- [ ] Identity, contact details, and any required Android-device verification completed.

### Offline package

- [ ] Android build performs no network acquisition.
- [x] Asset counts and hashes match the approved release-input manifest.
- [x] Android catalog contains no source/provenance fields or remote image URLs.
- [x] Every image, worker, recognition file, font, guide asset, and legal page is packaged.
- [x] Service worker is absent from Android.
- [x] CSP blocks external runtime connections; packaged same-origin reads remain allowed.
- [x] URL/hostname scan passes.
- [ ] First launch in airplane mode passes with zero external requests.

### Data and device behaviour

- [ ] IndexedDB survives process death, restart, and signed update.
- [ ] Export/share and document import pass on representative devices.
- [ ] Large image-containing backup passes.
- [ ] Android Back contract passes every route/modal/edit state.
- [ ] Screenshot recognition completes offline on a mid-range device.
- [x] No broad storage/media/camera permission appears in the merged manifest.
- [ ] Accessibility, large text, small screen, tablet, rotation, and safe areas pass.
- [ ] Release build has no debug logging, source maps, test hooks, or secrets.

### Privacy and Play

- [x] Public privacy policy is reachable over HTTPS.
- [x] Offline privacy policy and About & Legal screen are included.
- [ ] Non-affiliation statement appears in About, store listing, and briefly in privacy policy.
- [ ] Open-source dependency notices match the release lockfile.
- [ ] Data safety, ads, app access, audience, rating, and permissions match the final AAB.
- [ ] Target API requirement rechecked on submission day.
- [ ] Play Console per-device compressed size reviewed.
- [ ] Internal and closed test evidence is complete for the exact production artifact.

## Recommended implementation order

1. Lock package ID, developer identity, privacy URL, support contact, versioning, and minimum SDK.
2. Add the `web`/`android` distribution contract and separate `dist-android/` output.
3. Implement the frozen-asset verifier, private manifest, stripped Android catalog, and no-network build.
4. Disable Android service-worker/source-link behaviour and pass the first-launch offline web-output test.
5. Add Capacitor Android and native project configuration.
6. Implement platform adapters for lifecycle, Back, version info, export, import, and optional external actions.
7. Add About & Legal plus public/offline privacy policy.
8. Add Android CI, signing, AAB inspection, and size/network gates.
9. Complete the physical-device matrix.
10. Move the identical AAB through internal testing, closed testing, and staged production.

## Current official references to recheck during implementation

- [Capacitor installation and `webDir`/sync workflow](https://capacitorjs.com/docs/getting-started)
- [Capacitor Android support and setup](https://capacitorjs.com/docs/android)
- [Capacitor App lifecycle and Back APIs](https://capacitorjs.com/docs/apis/app)
- [Capacitor Filesystem API](https://capacitorjs.com/docs/apis/filesystem)
- [Capacitor Share API](https://capacitorjs.com/docs/apis/share)
- [Google Play target API requirement](https://developer.android.com/google/play/requirements/target-sdk)
- [Android App Bundle overview](https://developer.android.com/guide/app-bundle)
- [Google Play app size guidance](https://support.google.com/googleplay/android-developer/answer/9859372?hl=en-GB)
- [Personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)
- [Personal-account device verification](https://support.google.com/googleplay/android-developer/answer/14316361?hl=en)
- [Developer account information and public disclosures](https://support.google.com/googleplay/android-developer/answer/13628312?hl=en)
