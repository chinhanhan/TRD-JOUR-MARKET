# Journal closed-trade sorting — 2026-09-09

The Completed records section now supports four display orders: newest, oldest, highest R, and lowest R.

- Sorting applies to the closed-trade table and its mobile cards after the existing search and filters are applied.
- Open trades and the date-grouped SOP timeline keep their existing chronological behavior.
- R ordering uses the same `Net P&L / risk` rule as the rest of the product. Missing or invalid risk produces `0R` rather than a fabricated result.
- Equal-R records use newest-first chronology and stable IDs for deterministic output.
- The selected order is temporary UI state. It does not call `saveState()`, alter a trade, or write to Firestore.
