---
"@voyantjs/inventory": minor
"@voyantjs/catalog-authoring": patch
---

Move product graph compose/duplicate authoring behind
`@voyantjs/inventory/authoring`. `@voyantjs/catalog-authoring` now delegates to
the Inventory owner path during the v1 restructure.
