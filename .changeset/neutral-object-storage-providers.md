---
"@voyant-travel/core": patch
"@voyant-travel/bookings": patch
"@voyant-travel/db": patch
"@voyant-travel/finance": patch
"@voyant-travel/framework": patch
"@voyant-travel/hono": patch
"@voyant-travel/inventory": patch
"@voyant-travel/legal": patch
"@voyant-travel/runtime": patch
"@voyant-travel/runtime-core": patch
"@voyant-travel/storage": patch
---

Make deployment provider selection authoritative for Node storage, cache, shared
state, and rate limiting. Replace vendor-specific object-store bindings and R2
shims with logical media/document stores, a memory provider, an AWS SDK v3
S3-compatible provider, and package-selected custom adapters. Add a portable
storage provider conformance runner, resolve adapters from the `storage.object`
graph provider, and make provider config/secret/resource usage explicit. Keep
distributed shared state and rate-limit KV authoritative by bypassing the
cache-only process-local L1, and move guest booking lookups onto the selected
atomic rate-limit store. Remove the former R2/SigV4 exports.
