---
"@voyant-travel/admin": patch
"@voyant-travel/admin-app": patch
"@voyant-travel/action-ledger-react": patch
"@voyant-travel/apps-react": patch
"@voyant-travel/auth-react": patch
"@voyant-travel/bookings-react": patch
"@voyant-travel/catalog-react": patch
"@voyant-travel/commerce-react": patch
"@voyant-travel/custom-fields-react": patch
"@voyant-travel/distribution-react": patch
"@voyant-travel/finance-react": patch
"@voyant-travel/flights-react": patch
"@voyant-travel/identity-react": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/legal-react": patch
"@voyant-travel/mice-react": patch
"@voyant-travel/navigation-preferences-react": patch
"@voyant-travel/notifications-react": patch
"@voyant-travel/operations-react": patch
"@voyant-travel/operator-settings-react": patch
"@voyant-travel/quotes-react": patch
"@voyant-travel/relationships-react": patch
"@voyant-travel/trips-react": patch
---

Give every admin screen consistent page spacing. Previously each page invented
its own padding (`p-6`, `px-6 py-6 lg:px-8`, `container mx-auto py-6` with no
horizontal padding, or none at all), so screens like the booking engine had no
spacing while others differed.

The admin workspace layout now wraps the page outlet in a single padded content
region (`px-4 py-6 md:px-6`), and the per-page root padding was removed so it no
longer double-pads (max-width caps are kept). The full-height settings two-pane
bleeds back out of that padding and re-applies its own so it stays edge-to-edge.
