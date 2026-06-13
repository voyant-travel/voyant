---
"@voyantjs/inventory": minor
"@voyantjs/inventory-react": minor
"@voyantjs/products": patch
"@voyantjs/products-react": patch
"operator": patch
---

Move the main operated Product route/service/schema/runtime and React
authoring source under Inventory owner paths. `@voyantjs/products` and
`@voyantjs/products-react` now remain compatibility packages over Inventory,
while the operator keeps stable `/products` URLs and the legacy generated schema
manifest specifier until Inventory manifest parity is handled in a later slice.
