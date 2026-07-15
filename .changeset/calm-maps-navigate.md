---
"@voyant-travel/admin": minor
"@voyant-travel/admin-app": patch
"@voyant-travel/admin-host": patch
"@voyant-travel/core": minor
"@voyant-travel/framework": minor
"@voyant-travel/hono": minor
"@voyant-travel/navigation-preferences": minor
"@voyant-travel/navigation-preferences-react": minor
"@voyant-travel/operator-standard": minor
---

Add organization defaults and member overrides for stable admin navigation IDs. Apply visibility
after selected navigation composition without exposing ineligible routes, inherit hidden parent
state through navigation subtrees, and retain structural parents only when a child is explicitly
re-enabled. Ship the persistence, admin API, provisioning seam, and settings UI in standard Operator
deployments, with duplicate settings contributions normalized at the host and core boundaries.
