---
"@voyant-travel/dedicated-runtime": minor
---

Add `@voyant-travel/dedicated-runtime`: a Node server entry plus the real
in-process providers an operator app needs so its identical `fetch`/`scheduled`
code runs on a dedicated Node runtime (Cloud Run). Node is the first-class
production target for operator deployments — the composed graph cannot stay
resident on Cloudflare Workers (evaluated-heap eviction). Exports:
`createNodeServer` (origin-trust gate, Cloud Scheduler `scheduled()` hook over
`POST /__voyant/scheduled`, real `waitUntil` registry with graceful SIGTERM
drain), `composeNodeEnv`, `createMemoryKvNamespace` (in-process KV for
`CACHE`/`RATE_LIMIT`), `createMemoryR2Bucket` (dev object store), and
`createR2BucketShim` (S3-compatible object store for prod, via
`@voyant-travel/storage` SigV4). There is no Workers lane for the operator, so
this ships real Node providers rather than Cloudflare-binding emulation. See
voyant-travel/platform#935 and voyant#2966.
