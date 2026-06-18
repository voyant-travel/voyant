---
"@voyant-travel/finance-react": minor
---

Add optional product/departure attribution to the supplier-invoice create dialog. When a host wires `searchProducts` (and optionally `listDeparturesForProduct`), the create form gains a two-step product → departure picker plus a total field; on save it emits a single whole-invoice manual cost allocation seeded from the total, targeting the picked departure (or, failing that, the product). All new strings are added to the `supplierInvoiceDetail.form` messages (en + ro). Edit mode and hosts that don't pass `searchProducts` are unaffected.
