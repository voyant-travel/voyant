---
"@voyant-travel/accommodations": minor
"@voyant-travel/action-ledger": minor
"@voyant-travel/bookings": minor
"@voyant-travel/catalog": minor
"@voyant-travel/charters": minor
"@voyant-travel/commerce": minor
"@voyant-travel/cruises": minor
"@voyant-travel/distribution": minor
"@voyant-travel/finance": minor
"@voyant-travel/flights": minor
"@voyant-travel/framework": minor
"@voyant-travel/hono": minor
"@voyant-travel/identity": minor
"@voyant-travel/inventory": minor
"@voyant-travel/legal": minor
"@voyant-travel/mcp": minor
"@voyant-travel/mice": minor
"@voyant-travel/navigation-preferences": minor
"@voyant-travel/notifications": minor
"@voyant-travel/operations": minor
"@voyant-travel/operator-settings": minor
"@voyant-travel/public-document-delivery": minor
"@voyant-travel/quotes": minor
"@voyant-travel/realtime": minor
"@voyant-travel/relationships": minor
"@voyant-travel/setup": minor
"@voyant-travel/storage": minor
"@voyant-travel/storefront": minor
"@voyant-travel/trips": minor
"@voyant-travel/workflow-runs": minor
---

Make Hono the explicit sole server API runtime while moving package and
deployment interfaces to role-based API vocabulary. Replace Hono-prefixed module,
extension, bundle, lazy-route, and factory names with `Api*` names; move
router-named domain runtime entry points to `./api-runtime`; and remove the old
names without compatibility aliases.
