---
"@voyant-travel/inventory": minor
"@voyant-travel/inventory-react": minor
"@voyant-travel/bookings": minor
"@voyant-travel/bookings-react": minor
"@voyant-travel/extras-contracts": patch
"@voyant-travel/catalog-authoring": patch
"@voyant-travel/storefront": patch
---

Move extras runtime and React source behind Inventory and Bookings owner
subpaths. The old runtime and React extras package names are removed from v1;
first-party imports use the Inventory and Bookings owner paths.
