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

Expose extras through Inventory and Bookings owner subpaths. Keep the legacy
extras runtime and React packages as temporary compatibility shims while
first-party imports move to the owner paths.
