---
"@voyantjs/inventory": minor
"@voyantjs/inventory-react": minor
"@voyantjs/bookings": minor
"@voyantjs/bookings-react": minor
"@voyantjs/extras": patch
"@voyantjs/extras-react": patch
"@voyantjs/extras-contracts": patch
"@voyantjs/availability-react": patch
"@voyantjs/catalog-authoring": patch
"@voyantjs/products": patch
"@voyantjs/products-react": patch
"@voyantjs/storefront": patch
---

Move extras runtime and React source behind Inventory and Bookings owner
subpaths. The legacy extras packages now act as compatibility shims while
first-party imports move to the owner paths.
