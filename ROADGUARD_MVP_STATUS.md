# RoadGuard MVP Status

**Date:** 24 October 2026  
**Project:** `E:\xampp\htdocs\RoadGuard\RoadGuard`  
**Status:** MVP implementation is substantially in place, but it is **not yet ready for final visual QA or release**. No new APK was built, no emulator is currently attached, and no rendered screen was visually inspected.

## Implemented

- First-run onboarding for car, motorcycle, and bus/minibus, with a saved vehicle choice.
- Map/dashboard with GPS opt-in, permission/error status, demo/offline fallback, and map loading/retry messaging.
- Configurable 250 m, 500 m, and 1,000 m foreground warning distances; voice alert toggle and repeat control; geofence entry deduplication logic.
- Seeded map area marked as illustrative demo data, never as a confirmed official enforcement point. Unsupported local fine amounts were removed.
- Laws and Rights screens with explicit unverified/reference limitations and no invented specific legal guidance.
- Local checkpoint reporting with device persistence and two-hour expiry. Coordinates are sent only after a report tap when an API URL is configured.
- Optional Node API, PostgreSQL/Neon migration, validation, rate limiting, published law/zone endpoints, expiring community reports, version history, token-protected admin JSON editor, and placeholder-only `server/.env.example`.
- Android native foreground location service with persistent notification, staged permission requests, vehicle/distance filtering, and entry-only notification behavior. It is implemented in source but remains uncompiled and unverified on a device.

## Verification completed

- `npx tsc --noEmit` — passed.
- `npm test -- --runInBand` — passed: 6 suites, 12 tests.
- `npm run test:server` — passed: 5 tests, including degraded operation without Neon configuration.
- `npm run lint` — passed with 0 errors and 1 warning in the pre-existing archived `RoadGuardNative-v1-foundation/RoadGuardNative/App.tsx`.
- `node --check server/src/server.mjs` and `node --check server/src/validation.mjs` — passed.
- React Native production Android JavaScript bundle — passed; output is `android/build/roadguard-mvp-validation.bundle` (993,227 bytes). Metro emitted the existing RN feature-flags package-export fallback warning.
- `git diff --check` — passed.

## Not verified / blockers

- **Android build and APK:** No current APK was generated. A pre-existing `android/app/build/outputs/apk/debug/app-debug.apk` is dated 23 October 2026 and is not evidence that the current source builds. The prior normal-Windows Gradle run used `C:\Users\HP\.gradle`; it previously timed out fetching KSP, whose exact 60,349,850-byte JAR is now present in both the HP cache and Codex's separate `C:\Users\CodexSandboxOffline\.gradle` cache. On 25 October, a single offline build to a fresh output root under `android/build/roadguard-recovery` got as far as `:react-native-async-storage_async-storage:kspDebugKotlin`, then failed because the Codex cache lacks multiple AndroidX artifacts (including Room 2.7.2). HTTPS probes to Maven Central and Google Maven from this Codex environment failed before TLS with Schannel `SEC_E_NO_CREDENTIALS`; therefore an online build here is not justified. The earlier package-resource cleanup report was not reproduced with the fresh output root. About 571 GB is free on E:. `adb devices -l` found no connected device, and the SDK emulator lists no configured AVD.
- **Visual rendering/navigation:** Automated component tests cover onboarding and settings controls, but they do not replace inspecting the app on an installed Android build. White-screen resolution and map behavior are not claimed.
- **Neon/API:** The no-database degraded path is tested. No database credentials, live Neon instance, migration run, or deployed HTTPS API was available. Set server-only `DATABASE_URL` and a random 32+ character `ADMIN_TOKEN`, install server dependencies, apply the migration, and test from a deployed environment before claiming live integration.
- **Legal content:** No authoritative source or reviewer was supplied. Local legal records remain placeholders; do not publish a legal amount until a source and review are recorded.
- **Maps:** No Google Maps API key is present. Map tiles may remain unavailable; other screens should remain usable.
- **Background geofencing:** Native implementation has not been compiled, and Android background permission/service, notification, entry, duplicate suppression, exit/re-entry, battery behavior, and OEM restrictions have not been tested on a physical phone.

## Manual visual QA checklist

1. **Onboarding:** On a fresh app install, select each vehicle type, continue, and verify the selected vehicle is restored after relaunch. Skip GPS and confirm the app still opens in demo mode.
2. **Map/dashboard:** Verify the map loading and missing-key states; demo zones are clearly marked as not official; vehicle selection, report empty state, and offline messaging remain visible and usable.
3. **Foreground GPS/warnings:** Grant and deny location separately. With GPS enabled, check warning behavior just inside/outside each configured threshold and verify one voice alert per entry, a repeat control, and no voice when disabled.
4. **Community reports:** Submit only after an explicit tap, confirm whether it was saved locally or submitted to the configured community API, and verify the report is labeled community/not official and disappears after expiry.
5. **Laws:** Confirm no unverified fine values appear and each record shows its review/provenance status. Verify the empty state when the service has no published records.
6. **Rights:** Confirm the general-information limitation is visible and the screen makes no unsupported claims about legal powers or outcomes.
7. **Settings:** Change warning distance and voice, relaunch and verify persistence; test GPS denial, API URL validation/offline state, and background permission denial/recovery.
8. **Background alerts (physical phone required):** Enable “Allow all the time” plus notifications; confirm persistent monitoring notification; enter, remain in, exit, and re-enter an area; verify one notification per entry and no location history on the server.

## Emulator versus physical-device verification

- **Emulator:** Suitable for screen navigation, onboarding/settings persistence, permission-denied flows, API offline states, map-key fallback, and simulated location paths after a successful build. No emulator is currently attached.
- **Physical Android phone required before claiming support:** Background location across app/background/process lifecycle, notification permission behavior, manufacturer battery restrictions, actual GPS accuracy, geofence duplicate suppression while driving, and service recovery after GPS/permission changes.

## Files

- Audit and task acceptance criteria: [ROADGUARD_IMPLEMENTATION_PLAN.md](E:/xampp/htdocs/RoadGuard/RoadGuard/ROADGUARD_IMPLEMENTATION_PLAN.md)
- Optional API setup: [README.md](E:/xampp/htdocs/RoadGuard/RoadGuard/README.md)
- API schema: [001_initial_schema.sql](E:/xampp/htdocs/RoadGuard/RoadGuard/server/migrations/001_initial_schema.sql)
- Android monitor service: [RoadGuardMonitoringService.kt](E:/xampp/htdocs/RoadGuard/RoadGuard/android/app/src/main/java/com/roadguard/RoadGuardMonitoringService.kt)
