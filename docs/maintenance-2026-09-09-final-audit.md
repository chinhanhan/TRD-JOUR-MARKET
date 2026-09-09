# Final release audit — 2026-09-09

This pass closes the current maintenance cycle with a low-risk runtime cleanup and a full release verification.

## Changes

- Replaced the remaining blocking `alert()` calls in public runtime code with non-blocking in-app toasts.
- Removed an obsolete, uncalled Dock implementation; `dock.js` remains the single Dock controller.
- Removed production debug logs while preserving warning and error diagnostics.
- Corrected the landing-page privacy explanation so it accurately describes account isolation and authorized service access.
- Added a static integrity rule that prevents blocking alerts and debug logs from returning to shipped JavaScript.
- Bumped the asset and offline cache version to `v212`.

## Protected behavior

- `saveState()` still publishes the current state to `window.state` first.
- SOP deletion still removes matching entries from `preferences.setups`.
- R-multiple remains Net P&L divided by `trade.risk`.
- Cloud sync failures remain non-blocking and use the application toast.
- The deployment remains compatible with the Firebase Spark plan and Hosting-only release flow.

## Release checks

- Automated unit and integrity tests.
- Firestore rules emulator tests.
- JavaScript syntax validation for every shipped script.
- Desktop and mobile smoke checks of the landing, authentication, navigation, trade entry, Journal, Review, and System surfaces.
- Generated Hosting output compared with the reviewed public-file allowlist.
