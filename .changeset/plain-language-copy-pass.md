---
"@voyant-travel/bookings-react": patch
"@voyant-travel/catalog-react": patch
"@voyant-travel/charters-react": patch
"@voyant-travel/commerce-react": patch
"@voyant-travel/cruises-react": patch
"@voyant-travel/custom-fields-react": patch
"@voyant-travel/distribution-react": patch
"@voyant-travel/finance-react": patch
"@voyant-travel/flights-react": patch
"@voyant-travel/i18n": patch
"@voyant-travel/identity-react": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/legal-react": patch
"@voyant-travel/media-react": patch
"@voyant-travel/notifications-react": patch
"@voyant-travel/operations-react": patch
"@voyant-travel/quotes-react": patch
"@voyant-travel/relationships-react": patch
"@voyant-travel/setup-react": patch
---

Plain-language copy pass across the admin UI. Rewrites microcopy on the
non-developer screens so it reads for travel professionals rather than
engineers: removes developer jargon (entity, tenant, adapter/connector,
payload, sync/reconcile internals, raw database column names and code
fragments), strips internal/roadmap notes that leaked into user copy, cuts
verbose and redundant helper text, and aligns terminology to the canonical
Ubiquitous Language (Traveler over pax/guest, Supplier, Quote/Quote Version,
"record" instead of "entity") with consistent sentence case. English catalog
copy only; ICU placeholders and en/ro key parity preserved.
