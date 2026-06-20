---
"@voyant-travel/flights": patch
"@voyant-travel/catalog-authoring": patch
---

D.2: onboard package-owned migrations for `flights` and `catalog-authoring`.

Both packages own tables that the retired framework bundle materialised but had
no per-package migration source — `flights` owns the `reference_airlines` /
`reference_airports` / `reference_aircraft` reference tables, and
`catalog-authoring` owns `product_authoring_requests` (via its re-export of the
inventory authoring schema). Without their own migration folders a fresh D.2
database would silently miss these tables.

Each now ships a generated `migrations/` folder (baseline) and a `db:generate`
script, and is published in the package tarball. The D.2 union verifier gained a
**reverse-coverage** gate so an un-onboarded owner can never slip through again:
every bundle table must be claimed by some package source.
