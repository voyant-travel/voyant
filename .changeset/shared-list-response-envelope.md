---
"@voyant-travel/types": minor
"@voyant-travel/bookings": minor
"@voyant-travel/charters": minor
"@voyant-travel/commerce": minor
"@voyant-travel/cruises": minor
"@voyant-travel/distribution": minor
"@voyant-travel/finance": minor
"@voyant-travel/finance-contracts": minor
"@voyant-travel/identity": minor
"@voyant-travel/inventory": minor
"@voyant-travel/legal": minor
"@voyant-travel/legal-contracts": minor
"@voyant-travel/notifications": minor
"@voyant-travel/operations": minor
"@voyant-travel/quotes": minor
"@voyant-travel/relationships": minor
"@voyant-travel/bookings-react": minor
"@voyant-travel/charters-react": minor
"@voyant-travel/commerce-react": minor
"@voyant-travel/cruises-react": minor
"@voyant-travel/distribution-react": minor
"@voyant-travel/finance-react": minor
"@voyant-travel/identity-react": minor
"@voyant-travel/inventory-react": minor
"@voyant-travel/legal-react": minor
"@voyant-travel/notifications-react": minor
"@voyant-travel/operations-react": minor
"@voyant-travel/quotes-react": minor
"@voyant-travel/relationships-react": minor
---

Share one list-response contract instead of per-module copies (voyant#2109).

`@voyant-travel/types` now owns the canonical offset-paginated list envelope: the `ListResponse<T>` type + `listResponse(data, { total, limit, offset })` builder, plus the zod `paginationSchema` (coerced `limit` 1–200 default 50, `offset` ≥0 default 0) and the `listResponseSchema(item)` factory. Both server services and `*-react` clients import from this single source.

Server side: every module's local `paginate()` / inline `{ data, total, limit, offset }` construction now routes through the shared `listResponse` builder, and the count read is standardized on `count` internally — fixing the drift where finance, notifications and the legal contracts/policies services read `countResult[0]?.total` while every other module read `countResult[0]?.count` (their `count(*)` selects were aliased `total`; they are now aliased `count`). The returned shape is byte-for-byte identical.

Client side: the ~23 copied `paginatedEnvelope` zod schemas across the `*-react` packages are replaced by re-exporting the shared `listResponseSchema` factory under the same `paginatedEnvelope` name, so consumers are unchanged.

Input alignment: `finance-contracts` and `legal-contracts` pagination `limit` caps were raised from `.max(100)` to `.max(200)` to match the framework-wide max.

Additive and non-breaking.
