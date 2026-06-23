---
"@voyant-travel/accommodations": patch
"@voyant-travel/bookings": patch
"@voyant-travel/commerce": patch
"@voyant-travel/commerce-react": patch
"@voyant-travel/distribution": patch
"@voyant-travel/distribution-react": patch
"@voyant-travel/finance": patch
"@voyant-travel/finance-react": patch
"@voyant-travel/hono": patch
"@voyant-travel/identity-react": patch
"@voyant-travel/inventory": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/legal": patch
"@voyant-travel/legal-react": patch
"@voyant-travel/mice": patch
"@voyant-travel/notifications": patch
"@voyant-travel/notifications-react": patch
"@voyant-travel/observability-sentry": patch
"@voyant-travel/operations": patch
"@voyant-travel/operations-react": patch
"@voyant-travel/quotes": patch
"@voyant-travel/relationships": patch
---

Expose client-safe subpaths for validation schemas, linkable metadata, template authoring metadata, finance payment-policy primitives, and Hono reporter utilities. Move browser-facing React/operator imports off mixed runtime barrels so client bundles do not pull Hono request context or other server-only runtime code.
