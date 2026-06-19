---
"@voyant-travel/i18n": patch
"@voyant-travel/catalog-react": patch
---

Fix Romanian i18n gaps on operator admin surfaces.

- `@voyant-travel/catalog-react`: the cruises and accommodations browse pages rendered the static English route `title` prop as their heading; they now read the localized label from `useOperatorAdminMessages().nav.*`, matching the other catalog verticals.
- `@voyant-travel/i18n`: corrected the quotes terminology in Romanian (operator nav + CRM org-detail) from "Cotatii" to "Oferte" so it matches the quotes package, and added a `trips.list.composeTrip` label (used by the operator's "Compose trip" action on the bookings list).
