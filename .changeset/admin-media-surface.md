---
"@voyant-travel/storage": minor
"@voyant-travel/framework": minor
"@voyant-travel/hono": minor
"@voyant-travel/worker-runtime": minor
"@voyant-travel/bookings-react": patch
"@voyant-travel/finance-react": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/quotes-react": patch
"@voyant-travel/plugin-netopia": patch
"@voyant-travel/plugin-smartbill": patch
"@voyant-travel/storefront": patch
---

Move the operator media upload and serve routes off the bare `/v1/*` surface and onto `/v1/admin/*`.

Uploads now post to `/v1/admin/uploads` and video tickets to `/v1/admin/uploads/video`; stored media is served from `/v1/admin/media/*`. The Hono app no longer mounts the bare `/v1/*` catch-all actor guard, and worker-runtime hosts can use `rewriteAppPath` to preserve compatibility for persisted legacy media URLs.
