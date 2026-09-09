# Trade-entry data validation — 2026-09-09

The full trade sheet now checks data consistency before it reads screenshots or changes in-memory state.

- Open trades continue to need no result or closing time.
- A completed trade requires both a closing time and an explicit Net P&L. Breakeven must be entered as `0`.
- Closing time cannot be earlier than opening time.
- Risk must be positive; supplied MAE/MFE values must be finite numbers.
- Errors appear together in the sheet, mark the related fields, and do not call `saveState()` or cloud sync.
- The existing quick close flow keeps its result/R fallback and prior validation behavior.

The pure rules live in `tradeValidationCore.js` and do not alter the R formula or normalized trade schema.
