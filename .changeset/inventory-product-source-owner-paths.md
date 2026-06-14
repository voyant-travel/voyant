---
"@voyant-travel/inventory": minor
"@voyant-travel/inventory-react": minor
"operator": patch
---

Move the main operated Product route/service/schema/runtime and React
authoring source under Inventory owner paths. The old Products runtime package
names are removed from the v1 workspace surface, while the operator keeps
stable `/products` API URLs backed by Inventory.
