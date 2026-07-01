---
"@voyant-travel/commerce": patch
"@voyant-travel/finance": patch
"@voyant-travel/finance-contracts": patch
---

Reject invalid or dangling pricing and tax reference-data before writing.
`POST /v1/admin/pricing/price-schedules` now rejects a nonexistent
`priceCatalogId` with a deterministic `invalid_reference` 400 instead of a 500.
Tax regime rates are bounded to the 0..100 percent domain (matching the
booking-tax calculator that divides by 100), and `POST
/v1/admin/finance/tax-policy-rules` rejects dangling `profileId`/`taxRegimeId`
references with an `invalid_reference` 400 (mirroring the existing tax-class
regime guard).
