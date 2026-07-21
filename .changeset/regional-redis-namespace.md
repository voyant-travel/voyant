---
"@voyant-travel/framework": minor
"@voyant-travel/hono": minor
"@voyant-travel/utils": minor
---

Add framework-owned Redis namespacing for managed regional cache and rate-limit
state. Redis KV and rate-limit adapters now accept an optional `keyPrefix`,
deployment/runtime Redis URL validation matches the Upstash-compatible REST URL
contract, and the Node runtime wires `REDIS_NAMESPACE` to
`voyant:v1:<namespace>:cache:` and `voyant:v1:<namespace>:rate:` prefixes while
keeping managed shared state on Postgres by default.
