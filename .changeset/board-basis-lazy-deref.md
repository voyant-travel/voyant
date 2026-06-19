---
"@voyant-travel/products-contracts": patch
"@voyant-travel/cruises-contracts": patch
---

Defer the cross-package `boardBasisSchema` dereference in the product and cruise `content-shape` schemas with `z.lazy(() => boardBasisSchema)`.

It was dereferenced at module-evaluation time, so app worker bundles (rolldown/vite) that split it into a circular chunk observed it `undefined` and threw `TypeError: Cannot read properties of undefined (reading 'nullable')`, 500ing every catalog read. No change to validation behavior or inferred types.
