---
"@voyant-travel/hono": patch
---

Make the app-wide `requestBodyLimit` cap content-type-aware (voyant#2114).

A prior fix raised the global ceiling to `MAX_GLOBAL_REQUEST_BODY_BYTES` (26 MiB)
so chunked media uploads (25 MiB file + multipart envelope) aren't rejected. That
also loosened migrated `.openapi()` JSON routes from the old `parseJsonBody` 10 MiB
cap up to 26 MiB.

`requestBodyLimit` now accepts an optional `jsonMaxBytes` and applies it (via a
case-sensitive `application/json` content-type match mirroring Hono's `jsonRegex`)
to JSON bodies, while non-JSON bodies (uploads) keep the outer `maxBytes` ceiling.
`createApp` wires `jsonMaxBytes` to `DEFAULT_REQUEST_BODY_LIMIT_BYTES` (10 MiB) and
`maxBytes` to `MAX_GLOBAL_REQUEST_BODY_BYTES` (26 MiB), restoring the 10 MiB JSON
cap for every migrated route while keeping uploads at 26 MiB. The 413 response
shape and GET/HEAD/OPTIONS skip are unchanged; both exports are unchanged.
