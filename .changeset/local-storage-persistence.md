---
"@voyant-travel/runtime": minor
---

Persist local (`memory` storage plan) uploads to disk so a self-hosted operator
running without a configured S3/R2 bucket keeps its media and documents across
restarts. Previously the in-memory provider dropped all bytes on restart while
the catalogue rows persisted in Postgres, leaving broken thumbnails. The Node
runtime now mirrors uploads to `<cwd>/.voyant/storage` (override with
`STORAGE_LOCAL_DIR`) and falls back to disk on read; writes are best-effort so a
read-only filesystem degrades to memory-only. The isomorphic `@voyant-travel/storage`
package is untouched — the `node:fs` decorator lives in the Node-only runtime.
