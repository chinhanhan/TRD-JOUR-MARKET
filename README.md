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
- **Backend / Cloud**: Firebase Auth, Cloud Firestore (Firebase Spark; no deployed Cloud Functions or Cloud Storage dependency)
- **Payments**: Local & International Gateways (Debit Card, TNG, Online Banking)

## Public deployment files

Firebase Hosting publishes only the generated `dist/` directory. GitHub stores
the source code and runs automated checks; this repository does not use Pages.
`scripts/prepare-hosting.cjs` lists the public runtime assets explicitly and copies
them without compilation or bundling. Backups, private screenshots, debug pages,
repository configuration, and unlisted files stay outside the deployment.

- Run `npm run prepare:hosting` to prepare and inspect the public files locally.
- Add new runtime files to the explicit list in `scripts/prepare-hosting.cjs`.
- Treat `dist/` as disposable output; do not store source files or backups there.
- Deploy Firebase Hosting with `npx firebase-tools deploy --only hosting` (or
  `npm run deploy`). Its predeploy hook automatically regenerates `dist/`.
- GitHub runs regression tests, the Firestore emulator and the same public-file
  build on pushes and pull requests. Hosting deployment remains a separate step.

This change takes effect on Firebase Hosting after deployment. It does
not delete original local files or remove files from Git history.

## Free-plan operation (v205)

The production deployment stays on Firebase Spark. Existing Stripe Payment Links
and the TNG/DuitNow QR remain available; membership is activated manually after
the owner verifies payment. No Cloud Functions, Secret Manager, billing account,
or Stripe webhook is required. Existing activation codes are handled by support.

See [free-plan operations](docs/free-plan-operations.md) for activation steps and
[the maintenance record](docs/maintenance-2026-09-03.md) for validation and local
backup recovery. `functions/` is retained as undeployed future code and test
fixtures; it is deliberately absent from `firebase.json` and public assets.

Spark has free usage limits; cloud services can become unavailable when their
quota is exhausted. Offline records remain local. Stripe processing fees remain
separate from Firebase hosting; no paid Firebase services are enabled.
