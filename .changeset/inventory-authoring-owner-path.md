---
"@voyantjs/inventory": minor
"@voyantjs/catalog-authoring": patch
---

Move product graph compose/duplicate authoring behind
`@voyantjs/inventory/authoring`. `@voyantjs/catalog-authoring` now delegates to
the Inventory owner path as a compatibility package during the v1 restructure.
