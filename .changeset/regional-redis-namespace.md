---
"@voyant-travel/framework": minor
"@voyant-travel/hono": minor
"@voyant-travel/utils": minor
---

Add framework-owned Redis namespacing for managed regional cache and rate-limit
state, plus a Node-only persistent TCP Redis adapter in the Framework boundary.
Redis KV and rate-limit adapters still preserve the Upstash-compatible HTTP(S)
REST path for edge and self-hosted consumers. Resident Node now accepts
`redis://` and `rediss://` TCP Redis URLs in addition to HTTP(S) REST, reuses
one lazy Redis client across cache, shared-state, and rate-limit roles, and
wires `REDIS_NAMESPACE` to `voyant:v1:<namespace>:cache:`,
`voyant:v1:<namespace>:state:`, and `voyant:v1:<namespace>:rate:` prefixes.
Managed Cloud requires `REDIS_NAMESPACE` for every Redis role, requires
`rediss://` for TCP while retaining HTTPS REST compatibility, rejects plaintext
`redis://`, and keeps managed shared state on Postgres by default.
