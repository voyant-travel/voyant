---
"@voyant-travel/storage": patch
---

Gateway storage provider: pin a tier prefix per store. `createGatewayStorageProvider` now accepts a `tier` option that is prepended to every object key on the wire (`media/…`, `documents/…`), which the asset-gateway uses to select the target bucket. The prefix is transparent to callers — keys passed in and returned stay un-prefixed, so `upload → get/delete` round-trips no longer double-prefix. `createGatewayGraphStorageProvider` pins `media`/`documents` accordingly. Fixes managed uploads failing with `400 invalid_key` because the media module's `uploads/media/…` keys reached the gateway without a tier segment.
