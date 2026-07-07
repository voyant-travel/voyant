---
"@voyant-travel/utils": minor
"@voyant-travel/db": minor
"@voyant-travel/hono": minor
"@voyant-travel/framework": minor
"@voyant-travel/runtime": patch
"@voyant-travel/core": patch
"@voyant-travel/inventory": patch
---

Add Node-native cache and shared-state providers behind the existing KVStore
surface, including in-process LRU, tiered Redis/Postgres providers, Postgres
fixed-window rate limiting, Redis rate limiting, and managed-runtime provider
selection without KV-shaped binding requirements.
