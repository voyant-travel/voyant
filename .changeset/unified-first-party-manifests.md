---
"@voyant-travel/admin": minor
"@voyant-travel/auth": minor
"@voyant-travel/auth-react": minor
"@voyant-travel/bookings": minor
"@voyant-travel/distribution-react": minor
"@voyant-travel/finance-react": minor
"@voyant-travel/framework": minor
"@voyant-travel/operator-standard": minor
"@voyant-travel/realtime": minor
"@voyant-travel/quotes-react": minor
"@voyant-travel/runtime": minor
"@voyant-travel/storage": minor
"@voyant-travel/accommodations": patch
"@voyant-travel/action-ledger": patch
"@voyant-travel/availability": patch
"@voyant-travel/bookings-react": patch
"@voyant-travel/catalog": patch
"@voyant-travel/catalog-authoring": patch
"@voyant-travel/catalog-react": patch
"@voyant-travel/charters": patch
"@voyant-travel/commerce": patch
"@voyant-travel/commerce-react": patch
"@voyant-travel/core": patch
"@voyant-travel/cruises": patch
"@voyant-travel/db": patch
"@voyant-travel/distribution": patch
"@voyant-travel/finance": patch
"@voyant-travel/flights": patch
"@voyant-travel/flights-react": patch
"@voyant-travel/identity": patch
"@voyant-travel/identity-react": patch
"@voyant-travel/inventory": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/legal": patch
"@voyant-travel/legal-react": patch
"@voyant-travel/mcp": patch
"@voyant-travel/mice": patch
"@voyant-travel/notifications": patch
"@voyant-travel/notifications-react": patch
"@voyant-travel/operations": patch
"@voyant-travel/operations-react": patch
"@voyant-travel/operator-settings": patch
"@voyant-travel/public-document-delivery": patch
"@voyant-travel/quotes": patch
"@voyant-travel/quotes-contracts": patch
"@voyant-travel/relationships": patch
"@voyant-travel/relationships-react": patch
"@voyant-travel/storefront": patch
"@voyant-travel/trips": patch
"@voyant-travel/trips-react": patch
"@voyant-travel/types": patch
"@voyant-travel/voyant-typescript-config": patch
"@voyant-travel/workflow-runs": patch
"@voyant-travel/workflows": patch
"@voyant-travel/workflows-orchestrator": patch
---

Standardize first-party packages on package-owned deployment manifests, provider selection,
access metadata, concrete event contracts, selected admin navigation, and published runtime
references. Add Bookings Extras as an independently selected graph unit and remove the central
admin navigation catalog.
Link facets now distinguish entity `linkable` metadata from executable `definition` exports, and
generated Node registries reject malformed definitions before service registration.
Provider-owned required config and secrets now apply only when that provider is selected, so
local and in-memory deployments do not require credentials for inactive remote providers.
