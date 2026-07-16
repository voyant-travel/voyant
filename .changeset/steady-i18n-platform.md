---
"@voyant-travel/admin": patch
"@voyant-travel/admin-host": patch
"@voyant-travel/auth-react": patch
"@voyant-travel/bookings-react": patch
"@voyant-travel/catalog-react": patch
"@voyant-travel/charters-react": patch
"@voyant-travel/commerce-react": patch
"@voyant-travel/cruises-react": patch
"@voyant-travel/distribution-react": patch
"@voyant-travel/event-catalog-react": patch
"@voyant-travel/finance-react": patch
"@voyant-travel/flights-react": patch
"@voyant-travel/i18n": patch
"@voyant-travel/identity-react": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/legal-react": patch
"@voyant-travel/navigation-preferences-react": patch
"@voyant-travel/notifications-react": patch
"@voyant-travel/operations-react": patch
"@voyant-travel/operator-standard": patch
"@voyant-travel/quotes-react": patch
"@voyant-travel/relationships-react": patch
"@voyant-travel/workflows-react": patch
---

Strengthen the internationalization platform across the operator and package UI.

Add ICU message formatting, explicit locale and time-zone formatters, hierarchical
locale fallback, validated runtime overrides, account-authoritative preferences,
localized setup and navigation surfaces, and fail-closed catalog and UI-literal
checks. Package message providers now accept an optional time zone and expose the
shared formatting capabilities to package-owned UI.
