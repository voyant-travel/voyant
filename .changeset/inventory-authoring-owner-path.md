---
"@voyant-travel/inventory": minor
"@voyant-travel/catalog-authoring": patch
---

Move product graph compose/duplicate authoring behind
`@voyant-travel/inventory/authoring`. `@voyant-travel/catalog-authoring` now delegates to
the Inventory owner path during the v1 restructure.
