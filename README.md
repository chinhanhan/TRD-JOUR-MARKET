# TRD Journey (Market Edition)

> A Trading Performance Improvement Platform.

TRD Journey is an Apple-inspired trading journal and behavioral review operating system designed to help serious traders log, review, and master their execution discipline.

## Core Pillars
- **Trade Logging**: Capture entry, stop, target, risk, P&L, and R-multiples.
- **SOP & Discipline Audit**: Track rule adherence, execution mistakes, and behavioral patterns.
- **Analytics Dashboard**: Live equity curve, strategy statistics, and mistake loss breakdown.
- **Weekly & Behavioral Review**: Identify systemic leaks in execution before they compound.

## SaaS Architecture
- **Client**: Vanilla JS / HTML5 / CSS3 (Apple Glassmorphism / visionOS Bento)
- **Backend / Cloud**: Firebase Auth, Cloud Firestore, Cloud Storage, Cloud Functions
- **Payments**: Local & International Gateways (Debit Card, TNG, Online Banking)

## Public deployment files

Firebase Hosting and GitHub Pages publish only the generated `dist/` directory.
`scripts/prepare-hosting.cjs` lists the public runtime assets explicitly and copies
them without compilation or bundling. Backups, private screenshots, debug pages,
repository configuration, and unlisted files stay outside the deployment.

- Run `npm run prepare:hosting` to prepare and inspect the public files locally.
- Add new runtime files to the explicit list in `scripts/prepare-hosting.cjs`.
- Treat `dist/` as disposable output; do not store source files or backups there.
- Deploy Firebase Hosting with `npx firebase-tools deploy --only hosting` (or
  `npm run deploy`). Its predeploy hook automatically regenerates `dist/`.
- GitHub Pages regenerates the same directory before uploading its artifact.
  Its `main` push workflow remains separate from Firebase Hosting deployment.

This change takes effect on each hosted site after that site is deployed. It does
not delete original local files or remove files from Git history.

## Maintenance and coordinated rollout

See [the September 2026 maintenance record](docs/maintenance-2026-09-03.md) for
validation, legacy local-data recovery requirements, and the backend/Stripe setup
required before publishing this version. Do not publish the new frontend alone.
