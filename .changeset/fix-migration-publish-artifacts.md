---
"@voyant-travel/distribution": patch
"@voyant-travel/admin": patch
"@voyant-travel/admin-app": patch
"@voyant-travel/admin-client": patch
"@voyant-travel/admin-contracts": patch
"@voyant-travel/admin-react": patch
"@voyant-travel/action-ledger-react": patch
"@voyant-travel/auth": patch
"@voyant-travel/auth-react": patch
"@voyant-travel/bookings-react": patch
"@voyant-travel/catalog-react": patch
"@voyant-travel/charters-react": patch
"@voyant-travel/commerce-react": patch
"@voyant-travel/cruises-react": patch
"@voyant-travel/distribution-react": patch
"@voyant-travel/finance-react": patch
"@voyant-travel/flights-react": patch
"@voyant-travel/identity-react": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/legal-react": patch
"@voyant-travel/notifications": patch
"@voyant-travel/notifications-react": patch
"@voyant-travel/operations-react": patch
"@voyant-travel/plugin-netopia": patch
"@voyant-travel/plugin-smartbill": patch
"@voyant-travel/products-contracts": patch
"@voyant-travel/quotes-react": patch
"@voyant-travel/relationships-react": patch
"@voyant-travel/storefront-react": patch
"@voyant-travel/suppliers-contracts": patch
"@voyant-travel/trips-react": patch
"@voyant-travel/utils": patch
"@voyant-travel/ui": patch
"@voyant-travel/workflows-react": patch
---

Fix migration-facing publish artifacts by exporting all Distribution-owned supplier and external-reference schemas, republishing contract packages with complete dist files, republishing notification and UI consumers so stale beta artifacts no longer point at legacy package scopes, guarding packed artifacts against legacy package-scope specifiers, and updating Voyant Cloud defaults to `https://api.voyant.travel`.
