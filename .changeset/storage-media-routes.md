---
"@voyant-travel/storage": minor
---

The storage module now owns the media upload + serve routes: new `@voyant-travel/storage/routes` export (`createMediaRoutes(options)`) with the R2 storage provider and video upload-ticket signer injected as options. Adds `hono`/`zod` as peer/dev deps; depends only on `hono` (not `@voyant-travel/hono`) to avoid a cycle.
