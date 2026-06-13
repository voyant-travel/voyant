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
"@voyantjs/extras-react": patch
"@voyantjs/finance": patch
"@voyantjs/finance-react": patch
"@voyantjs/flights-react": patch
"@voyantjs/identity-react": patch
"@voyantjs/inventory": patch
"@voyantjs/inventory-react": patch
"@voyantjs/legal-react": patch
"@voyantjs/markets": patch
"@voyantjs/octo": patch
"@voyantjs/operations": patch
"@voyantjs/operations-react": patch
"@voyantjs/pricing": patch
"@voyantjs/promotions": patch
"@voyantjs/sellability": patch
"@voyantjs/sellability-react": patch
"@voyantjs/storefront": patch
---

Retarget first-party imports from v1 compatibility package names to their
owner-path packages. Operated product UI now imports Inventory React,
commercial UI imports Commerce React, supplier UI imports Distribution React,
checkout UI imports Finance React, and operated place/availability schema
references import Operations owner paths.
