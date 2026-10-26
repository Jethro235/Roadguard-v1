# RoadGuard MVP Implementation Plan

**Project:** `E:\xampp\htdocs\RoadGuard\RoadGuard`  
**Audit basis:** Current working tree and available source/configuration, 24 October 2026  
**Verification standard:** A source implementation is not considered verified until its automated checks pass; device-dependent behavior requires emulator/device evidence.

## Existing work and preservation

The repository already contains uncommitted changes in `App.tsx`, `README.md`, Android configuration, package metadata, Jest/TypeScript configuration, and untracked `src/`, tests support, logs, and an older audit report. These changes are preserved. Git requires the command-scoped `safe.directory` exception in this Codex account because the checkout is owned by `KINGKASPER\HP`; no global Git setting was changed.

## Audit findings

### Implemented in source, not yet verified as product behavior

- React Native CLI / TypeScript entry points are wired: `package.json` has no custom `main`, `app.json` names `RoadGuard`, and `index.js` registers `App` through `AppRegistry`.
- `App.tsx` installs `SafeAreaProvider` and a root rendering error boundary.
- `src/RoadGuardApp.tsx` contains a map dashboard, car/motorcycle/bus selection, foreground location permission and watch, demo coordinates, zone-distance check, warning card, TTS call, local checkpoint reporting/expiry, and Laws/Rights views.
- Checkpoints use AsyncStorage and are expired after two hours on load and while the app remains mounted.
- A Jest smoke test and mocks exist. They do not currently validate primary flows or geospatial/expiry logic.

These are code-level findings. No current emulator session, live API, or device verification was available as part of this audit.

### Missing or incomplete

- No onboarding or persisted vehicle preference; no settings screen; warning radius is fixed by each zone; voice has no on/off control.
- The map requires Google Maps configuration for tiles. No key is present, and no key will be invented. The surrounding app should remain usable when maps are unavailable.
- Location is a foreground JavaScript watch only. There is no Android background permission flow, foreground location service, notification channel, or verified background geofence behavior.
- Laws and rights copy has no official source URL, dates are placeholders, fine values are unreviewed, and there is no review status/versioning. Treat all existing legal values as unverified demo references until reviewed.
- Enforcement-zone coordinates are explicitly demo data in code but need stronger user-facing provenance/status labeling. They must not be represented as confirmed official enforcement locations.
- Community reports are local-only, without server validation, rate limiting, or cross-device availability. The UI must distinguish local/demo reports from shared reports.
- No Node API, Neon configuration, database migrations, admin review/publication interface, or `.env.example` exists in the active project.
- Error, loading, offline, empty, and permission-denied handling is partial. The home dashboard is a long single component and currently lacks onboarding, settings, and resilient saved preferences.
- Android manifest declares Internet and foreground fine/coarse location only. There are no background location or notification permissions/services. Background alerts need a deliberate, user-enabled Android foreground service and runtime permission handling.
- Existing tests cover rendering only. TypeScript/lint/test/build status must be freshly checked. Recent build logs show environmental Gradle dependency download failures; do not change versions/repositories/timeouts speculatively.

### Risks and external requirements

- Legal figures and advice need authoritative source URLs and human review before publication. This implementation must keep seeded records marked `demo` / `unverified` and avoid asserting legal accuracy.
- A production API requires a Neon connection string and an admin token. Neither is present; keep them server-side and provide placeholders only.
- A deployed HTTPS API endpoint is not available. The mobile client must stay useful offline and clearly report API unavailability.
- Google Maps tiles require a user-provided key and enabled billing/API restrictions. The map must degrade gracefully without it.
- Android background location policy and behavior require permission review and physical-device testing. Do not claim it works based solely on compilation or emulator execution.
- The current Codex process is isolated from the normal Windows account's TLS credential environment. Gradle artifacts have failed on network access; do not repeat a costly Android build until dependencies are reachable.

## Ordered implementation tasks and acceptance criteria

1. **Stabilize the mobile app shell and persistence.** Add first-run onboarding for car, motorcycle, and bus/minibus; persist selection and restore it on restart. Add settings for warning distance and voice, visible permission/GPS status, empty/error/offline copy, and resettable preferences.  
   **Accept when:** first launch shows onboarding; all vehicles can be selected; selection/settings survive restart; GPS denial retains usable demo mode; each main route remains reachable; touch targets are accessible.

2. **Make preventive alerts predictable.** Extract distance/zone transition logic, make warning distance configurable, deduplicate entry alerts, and make voice opt-in/toggleable. Label all seeded zones as demo/unverified and keep them distinguishable from published official data.  
   **Accept when:** unit tests cover distance, inside/outside threshold, entry deduplication/re-entry, and voice-disabled behavior; the UI displays provenance and warning distance.

3. **Make legal reference content safe.** Add source URL, effective/review dates, review status, and version identifiers to law records. Keep current unverified content marked demo/unreviewed and present a clear legal-information limitation.  
   **Accept when:** every displayed law has provenance/status; no unverified entry is labeled official or current; empty/error states are present.

4. **Add an optional backend and Neon schema.** Implement a Node API with health, published laws/zones, and community report endpoints; validation, rate limiting, error handling, two-hour expiry, migrations, and server-only environment credentials. Add an admin page/API for review and publication guarded by a server-side admin token. Provide `.env.example` placeholders and deployment/setup documentation.  
   **Accept when:** pure API validation/business logic tests pass; migrations define versioned legal records, provenance/publication status, official zones, and expiring community reports; server starts without secrets in explicit demo/unavailable mode; DB-backed mode is explicitly unverified until a real Neon instance is configured and tested.

5. **Integrate the optional API safely.** Keep local/demo mode the default, expose an explicit configurable API URL without storing credentials, avoid continuous GPS uploads, and only send coordinates after a user-requested report.  
   **Accept when:** API failure leaves laws/demo map/checkpoint UI usable and visibly offline; a report sends only the submitted point; no GPS history is persisted or transmitted.

6. **Implement Android background warning support responsibly.** Add a user-enabled Android location foreground service with staged foreground/background permission flow, visible notification/channel, zone-entry deduplication, and adjustable warning threshold. Keep foreground-only mode as a fully supported fallback.  
   **Accept when:** permission denials and service failures are handled; app clearly shows active monitoring state; native/unit tests cover geofence threshold/deduplication; a real Android device verifies entry/duplicate/re-entry/notification behavior before claiming background support.

7. **Verify and prepare visual QA.** Run TypeScript, lint, Jest, backend tests, and an Android build when dependency access permits. Exercise routes/loading/error/offline states on an emulator and record actual visual inspection; distinguish emulator-verified items from physical-device-only items. Save final results in `ROADGUARD_MVP_STATUS.md`.  
   **Accept when:** all available automated checks have results recorded; successful APK path/timestamp is recorded only if produced; each primary screen is visually viewed; the manual QA checklist identifies outstanding API credentials, map key, legal review, and real-device geofence checks.

## Execution order

Proceed through tasks 1–5 first so the app has complete foreground/offline MVP flows and a safe optional service. Implement native background monitoring as a separately switchable capability in task 6; if Android policy/device validation cannot be completed here, leave it explicitly marked unverified and do not block foreground operation. Finish with task 7 and report blockers honestly.

## Implementation progress

| Task | Status | Evidence / outstanding work |
|------|--------|-----------------------------|
| 1. Mobile shell and persistence | Implemented; automated checks pass | Onboarding, saved vehicle, warning distance, voice, API URL, foreground GPS opt-in, loading and error states; screen/component tests pass. Needs visual confirmation on an installed build. |
| 2. Preventive alerts | Implemented for foreground and Android native service | Configurable 250/500/1000 m radius; entry deduplication and re-entry helper; TTS can be disabled; seeded area is explicitly demo. Geospatial tests pass. Native service has not been built or physically tested. |
| 3. Legal references | Implemented as safe placeholders | Unsupported fine amounts removed; all local entries say unverified, while API publication requires HTTPS provenance and review metadata. Authoritative Nigerian sources and legal review remain required before publication. |
| 4. API, Neon schema, admin | Implemented; pure tests pass | `server/`, versioned law tables, published zones, expiring community reports, validation, rate limits, token-protected JSON admin page, migration, `.env.example`, and lockfile. Neon credentials and database were not available; live persistence is unverified. |
| 5. Optional API client | Implemented | HTTPS remote URL validation, local emulator development allowance, public data sync, user-requested-only location submission, and explicit offline fallback. No deployed endpoint configured. |
| 6. Android background monitoring | Implemented in native source; unverified | Foreground location service, staged background/notification permissions, persistent notification, vehicle and distance filters, entry-only notifications. Requires successful Android build and physical-device testing. |
| 7. Final verification | Partial | TypeScript, Jest, API tests, lint, Node syntax, and Metro Android bundle pass. Android build to fresh E: outputs stops at KSP because required AndroidX artifacts are absent from Codex's offline Gradle cache. HTTPS from this Codex session fails with Schannel `SEC_E_NO_CREDENTIALS`; the normal Windows session is needed for dependency resolution. No connected device/AVD or current APK is available, so visual verification remains outstanding. |
