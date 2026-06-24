---
"@voyant-travel/hono": patch
---

Require `Content-Type: application/json` for `.openapi()` JSON bodies (voyant#2114).

Hono's `json` validator supplies `{}` to the schema (instead of parsing) when a
request sends a body but omits — or mis-declares — the `application/json`
content-type. For schemas with required fields `{}` fails validation and yields
a clean 400, but for `.partial()` PATCH update schemas `{}` *validates*: the
handler then runs with an empty patch and silently no-ops (200), dropping the
caller's changes. This affected every migrated PATCH route with a partial body
schema.

`openApiValidationHook` now enforces the content-type the route's contract
declares for the `json` validation target, so a missing or non-json header is a
clean `invalid_request` 400 rather than a silent no-op. The regex accepts
`application/json`, `application/json; charset=utf-8`, and `application/vnd.x+json`;
only the `json` target is gated, so `query`/`param`/`header`/`form` (including
multipart uploads) are untouched. The fix is one place in the shared hook and
completes §16's content-type policy for all already-merged routes; no route or
spec changes required.
