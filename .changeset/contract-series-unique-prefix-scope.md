---
"@voyantjs/legal": patch
---

Fix #489: enforce uniqueness on `contract_number_series.(prefix, scope) WHERE active`.

Adds a partial unique index `uidx_contract_number_series_prefix_scope_active` so consumers can rely on a deterministic active-series-per-(prefix, scope) and seed scripts can use `ON CONFLICT` keys instead of racy SELECT-then-INSERT patterns.

Service changes in `contractSeriesService`:

- `findActiveByPrefixScope(db, prefix, scope)` — new lookup keyed on the natural unique pair. Throws `ContractSeriesAmbiguousError` if the index is bypassed and >1 active row exists (defense in depth).
- `upsertByPrefixScope(db, data)` — new idempotent create-or-update for consumer seed scripts; uses the partial unique index as the conflict target.
- `findSeriesByName(db, name)` — `@deprecated`; now throws `ContractSeriesAmbiguousError` on multi-match instead of silently picking the most-recently-updated row. Existing callers that rely on this resolution should migrate to `findActiveByPrefixScope` or archive duplicates (`active = false`).

`autoGenerateContractForBooking` accepts a new `seriesPrefixScope: { prefix, scope }` option that takes precedence over the now-`@deprecated` `seriesName`.

Migration shipped in `templates/dmc/migrations/0001_*.sql` and `templates/operator/migrations/0004_*.sql`. Deployments with existing duplicates must archive the older active rows (`active=false`) before applying or the migration will fail loudly — which is the intended signal.
