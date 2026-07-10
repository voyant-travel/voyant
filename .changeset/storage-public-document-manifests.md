---
"@voyant-travel/storage": minor
"@voyant-travel/public-document-delivery": minor
"@voyant-travel/hono": patch
---

Publish package-owned deployment manifests for storage media routes and public document delivery.

Move public document delivery into its own package while retaining the Hono compatibility export,
and expose storage upload, serve, and video-ticket routes independently from inventory brochures.
