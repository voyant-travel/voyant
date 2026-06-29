---
"@voyant-travel/hono": patch
---

Use a live operation-scoped database client for request outbox settlement so deferred subscriber completion or failure bookkeeping does not reuse a disposed request pool.
