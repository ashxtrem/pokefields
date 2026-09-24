# pokefields — Android release contract

**Status:** release identity, personal Play account type, and public contact locked on 2026-09-23; Play account verification remains blocked.

This contract contains stable release identifiers and public configuration only. Private legal identity, Play Console verification records, upload-key material, passwords, and recovery data must remain outside the repository.

## Locked identity

| Setting                     | Value                               | Change policy                                                                       |
| --------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| Android application ID      | `com.atcodepathi.pokopiafieldnotes` | Permanent after the first Play upload.                                              |
| Play developer display name | `AT.CodePathi`                      | Keep consistent across AT.CodePathi releases unless deliberately rebranded.         |
| Play developer account type | Personal                            | Selected by the account owner on 2026-09-23.                                        |
| Android display name        | `pokefields`                        | Exact launcher and Play-facing display name.                                        |
| Android launcher mark       | Cream leaf on forest green         | Generated from `public/favicon.svg` for legacy, round, adaptive, and themed icons.   |
| Initial version name        | `1.0.0`                             | Increment under semantic versioning.                                                |
| Initial version code        | `1`                                 | Increase for every Play upload; never reuse.                                        |
| Minimum Android SDK         | API 24 / Android 7.0                | Raising this requires an explicit device-coverage decision.                         |
| Compile Android SDK         | API 36                              | Recheck against the installed Capacitor/Android toolchain.                          |
| Target Android SDK          | API 36                              | Recheck Google Play policy before every submission.                                 |
| Supported orientation       | Portrait and landscape              | Restrict only if physical-device testing proves a layout unusable.                  |
| Distribution value          | `android`                           | Supplied through `.env.android`; production config must contain no live-reload URL. |

## Public endpoints

| Purpose        | Reserved value                     | Current state                                                                        |
| -------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| Privacy policy | `https://pokefields-privacy.pages.dev/privacy` | Dedicated legal origin; deployed and verified over HTTPS on 2026-09-23. |
| Support page   | `https://pokefields-privacy.pages.dev/support` | Dedicated legal origin; deployed and verified over HTTPS on 2026-09-23. |
| Support email  | `ashxtrem+pokefields@gmail.com`    | Public contact for the policy, support page, and Play listing.                       |

## Private Play Console state

- Legal developer identity: use the verified identity held by the Play Console account; do not duplicate private identity documents or unnecessary personal data in this repository.
- Identity-verification status: **TBD — owner must confirm before Play app creation**.
- Account creation date: **TBD — owner must confirm whether it was created before or after 13 November 2023**. Personal accounts created after that date must meet Google's current closed-testing requirement before applying for production access.
- Android device verification: **TBD — owner must complete any Play Console home-page verification task using the Play Console mobile app on a real, non-rooted Android device running Android 10 or later**.
- Upload-key owner, protected storage, recovery owner, and backup location: **TBD before release signing**.

## Personal-account publication consequences

- Google Play currently displays the verified legal name, country from the legal address, and developer email for personal accounts.
- If the account monetizes on Google Play, Google currently displays the full legal address.
- Contact email and phone details supplied to Google must be verified and kept operational. The release plan proposes `ashxtrem+pokefields@gmail.com` as the public developer email for consistency with support and privacy, but its Play Console verification remains pending.
- If the personal account was created after 13 November 2023, production access currently requires a closed test with at least 12 testers continuously opted in for at least 14 days, followed by a production-access application. Tester engagement and feedback must be documented; merely collecting opt-ins is not sufficient release evidence.

## Locked Android v1 product declarations

- Free application with no advertising, in-app purchases, subscriptions, analytics, crash-reporting SDK, cloud sync, remote database, or account system.
- Progress, plans, storage records, user-selected images, recognition results, and settings stay on the device.
- JSON backup export/import is user initiated.
- The installed application must work on first launch in airplane mode; Play installation itself may require connectivity.
- Public policy, offline policy, About & Legal copy, Data safety answers, permissions, and observed release-binary behaviour must agree.

## Native project state

The Capacitor Android project has been generated with the locked application ID and compiled as a debug APK against API 36. Its merged manifest confirms version `1.0.0` / code `1`, minimum API 24, target API 36, automatic backup disabled, cleartext traffic disabled, and no `INTERNET`, broad storage/media, or camera permission. Android backup export now writes the JSON payload to the app cache and hands the file to the system share/save sheet without broad storage permission; device-level export and document-import validation remain release gates.

Play app creation and signing remain blocked until their explicit TBDs are resolved. Runtime release gates still require a working emulator or physical device, airplane-mode first launch, persistence/upgrade, backup/share/import, Android Back, and screenshot-recognition validation.
