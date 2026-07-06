---
"@voyant-travel/runtime": minor
---

Introduce `@voyant-travel/runtime`, unifying the app runtime glue into one
honestly-named package. It merges the former `@voyant-travel/worker-runtime`
(request dispatch — `createWorkerFetch`, `lazySsr`, `createApiDispatch`,
SSR-manifest helpers) and the never-released `@voyant-travel/dedicated-runtime`
(the Node server + real providers — `createNodeServer`, origin-trust,
`waitUntil` registry, `composeNodeEnv`, `createMemoryKvNamespace`,
`createMemoryR2Bucket`, S3-backed `createR2BucketShim`). With Node the
first-class runtime (voyant#2966), "worker"/"dedicated" were both stale names
for what is simply the runtime.

BREAKING: `@voyant-travel/worker-runtime` is removed — import from
`@voyant-travel/runtime` instead (same export names and subpaths:
`./api-dispatch`, `./ssr-manifest`, `./worker-fetch`, `./types`, plus the Node
subpaths `./node-server`, `./trust`, `./wait-until`, `./env`, `./memory-kv`,
`./memory-r2`, `./r2`).
