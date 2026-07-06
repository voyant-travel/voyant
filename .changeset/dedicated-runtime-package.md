---
"@voyant-travel/dedicated-runtime": minor
---

Add `@voyant-travel/dedicated-runtime`: bindings emulation plus a Node server
entry so an operator app's identical `fetch`/`scheduled` code runs on a
dedicated Node runtime (Cloud Run) as it does on Cloudflare Workers for
Platforms. Includes KV (REST API + optional read-through LRU), R2 (S3-compatible
API via `@voyant-travel/storage` SigV4), an in-process Cache API shim, a real
`waitUntil` registry with graceful drain, `buildDedicatedEnv`, and
`createNodeServer` (origin-trust gate, Cloud Scheduler `scheduled()` hook, and
SIGTERM shutdown). See voyant-travel/platform#935.
