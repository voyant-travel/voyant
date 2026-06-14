---
"@voyantjs/accommodations": patch
"@voyantjs/action-ledger-react": patch
"@voyantjs/admin-app": patch
"@voyantjs/bookings": patch
"@voyantjs/bookings-react": patch
"@voyantjs/catalog-authoring": patch
"@voyantjs/catalog-react": patch
"@voyantjs/commerce-react": patch
"@voyantjs/distribution": patch
"@voyantjs/distribution-react": patch
"@voyantjs/finance": patch
"@voyantjs/finance-react": patch
"@voyantjs/flights-react": patch
"@voyantjs/identity-react": patch
"@voyantjs/inventory": patch
"@voyantjs/inventory-react": patch
"@voyantjs/legal-react": patch
"@voyantjs/octo": patch
"@voyantjs/operations": patch
"@voyantjs/operations-react": patch
"@voyantjs/storefront": patch
---

Retarget first-party imports from the removed beta package names to their owner
packages. Operated product UI now imports Inventory React, commercial UI imports
Commerce React, supplier UI imports Distribution React, checkout UI imports
Finance React, and operated place/availability schema references import
Operations owner paths.
