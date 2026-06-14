---
"@voyantjs/inventory": minor
"@voyantjs/inventory-react": minor
"@voyantjs/bookings": minor
"@voyantjs/bookings-react": minor
"@voyantjs/extras-contracts": patch
"@voyantjs/catalog-authoring": patch
"@voyantjs/storefront": patch
---

Move extras runtime and React source behind Inventory and Bookings owner
subpaths. The old runtime and React extras package names are removed from v1;
first-party imports use the Inventory and Bookings owner paths.
