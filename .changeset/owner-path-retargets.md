---
"@voyant-travel/accommodations": patch
"@voyant-travel/action-ledger-react": patch
"@voyant-travel/admin-app": patch
"@voyant-travel/bookings": patch
"@voyant-travel/bookings-react": patch
"@voyant-travel/catalog-authoring": patch
"@voyant-travel/catalog-react": patch
"@voyant-travel/commerce-react": patch
"@voyant-travel/distribution": patch
"@voyant-travel/distribution-react": patch
"@voyant-travel/finance": patch
"@voyant-travel/finance-react": patch
"@voyant-travel/flights-react": patch
"@voyant-travel/identity-react": patch
"@voyant-travel/inventory": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/legal-react": patch
"@voyant-travel/octo": patch
"@voyant-travel/operations": patch
"@voyant-travel/operations-react": patch
"@voyant-travel/storefront": patch
---

Retarget first-party imports from the removed beta package names to their owner
packages. Operated product UI now imports Inventory React, commercial UI imports
Commerce React, supplier UI imports Distribution React, checkout UI imports
Finance React, and operated place/availability schema references import
Operations owner paths.
