# Weekly action suggestion — 2026-09-05

The Review → Insights page now turns the current account's closed trades for the current Monday-to-Sunday period into one next-week focus.

## Guardrails

- Uses the existing `Net P&L / risk` definition of R.
- Open trades never enter the sample.
- Fewer than five closed trades produces a data-collection prompt, not a behavioral recommendation.
- A setup or session needs at least two trades before it appears as a signal.
- When one losing trade has several mistake tags, its loss R is divided equally across those tags. This prevents the displayed mistake cost from double counting the same loss.
- The copy describes mistake cost as an observed association, not proof that the tag caused the loss.
- The feature is read-only and does not save or sync any new state.

The pure calculations live in `weeklyReviewCore.js` and are covered by `tests/weekly-review.test.cjs`.
