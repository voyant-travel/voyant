---
"@voyant-travel/mice": minor
---

Consolidated commercials — program cost sheet / P&L (Phase 5).

`getProgramCostSheet` aggregates the program's committed inventory into a P&L —
room blocks (accommodations), space blocks (operations), and session inclusions
(mice) — reporting contracted exposure (held × net), realized cost/sell (picked
× net/sell), and program margin + margin %. No new spine tables (RFC §7): a
read model over what Phases 1–4 already persist. Exposed at
`GET /v1/admin/mice/programs/:id/cost-sheet`.

Follow-ups (not blocking): master/split billing via bookingDistributionDetails.
paymentOwner, attrition invoicing, and the mice.rfp.awarded auto-spawn workflow.
