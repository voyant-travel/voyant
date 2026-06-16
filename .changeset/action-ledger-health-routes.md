---
"@voyant-travel/action-ledger": minor
---

The action-ledger module now owns the health/drift routes: new exports `createActionLedgerHealthRoutes(options)` + `runActionLedgerHealthCheck` (from `@voyant-travel/action-ledger` and `./health`). The per-module drift checks (bookings/finance/inventory) are injected as options so action-ledger stays foundational (no static import of those packages).
