---
"@voyant-travel/operator-settings": minor
---

New package `@voyant-travel/operator-settings` — the operator-tenant settings domain (profile + payment instructions/defaults + booking-tax configuration). Owns the 5 tables (`./schema`, TypeID prefixes `opst/oppf/opin/opdp/btxs` unchanged) + the transport-agnostic readers/writers/validation (`./service`).

This is Stage 1 of the Workstream B step-4 extraction (see `docs/architecture/operator-settings-extraction.md`): the schema + data access move from the operator starter into a standard package, wired via `voyant.config` `additionalSchemas` (folded into the deployment's single combined migration history — no new migration; tables are byte-identical and already in snapshot 0067). The deployment's runtime wiring imports the readers directly from the package; `src/api/routes/settings.ts` keeps only the HTTP layer. The package is `additionalSchemas`-only (not a mounted module), so it stays out of the runtime/BOM lockstep set.
