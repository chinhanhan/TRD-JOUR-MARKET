# Performance and accessibility audit — 2026-09-12

This pass addresses the highest-confidence issues found after the v212 release without changing trading, persistence, entitlement, or cloud-sync behavior.

## Changes

- The Dock animation now runs only while its size is changing instead of requesting frames continuously while idle.
- The payment QR image loads only when needed, avoiding a 256 KB anonymous landing-page download.
- Chart.js loads only when the Long Game trend chart is opened.
- Removed the unused Firebase Storage client SDK from the public page.
- Added real PNG application icons for browser tabs, home-screen installation, and the web app manifest.
- Fixed landing-page color contrast, heading order, and the main landmark.
- Converted upgrade tier selectors to keyboard-accessible buttons with an announced selected state.
- Added long-lived caching for versioned static assets while keeping the service worker and HTML updateable.
- Avoided a duplicate full journal render when Firebase repeats the already-loaded guest owner during startup.

## Measured result

Lighthouse mobile simulation improved from the deployed v212 baseline of 45 performance / 91 accessibility / 96 best practices / 100 SEO to approximately 69–71 performance / 100 accessibility / 100 best practices / 100 SEO locally. Lighthouse performance varies between runs, so the categorical fixes and request traces are the primary evidence: no idle Dock reflow, no initial QR request, no initial Chart.js request, no Firebase Storage request, and no favicon error.

## Next priority

The remaining first-load cost comes mainly from parsing and initializing the full signed-in application for anonymous visitors. A future release should separate the public landing boot path from the authenticated journal boot path. That change should be implemented and tested as its own release because it touches authentication startup and offline account restoration.
