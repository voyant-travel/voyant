---
"@voyant-travel/hono": patch
---

Enforce the request body-size cap on the actual stream, not just `Content-Length` (voyant#2114).

The framework-level `requestBodyLimit` middleware previously only checked the
`Content-Length` header. The old `parseJsonBody` path additionally read the body
through a bounded reader, so it rejected oversized bodies even when no
`Content-Length` was present (chunked / HTTP/2). Routes migrated to `.openapi()`
read via Hono's `json` validator (`c.req.json()`), which bypasses `parseJsonBody`,
so a chunked / no-`Content-Length` oversized body was parsed unbounded — affecting
every migrated JSON-body route (public + admin).

`requestBodyLimit` now wraps Hono's built-in `bodyLimit`, which checks
`Content-Length` AND wraps the body stream to abort once the read exceeds the cap.
The existing 413 response shape is preserved via `bodyLimit`'s `onError`
(`{ error, code: "request_body_too_large", maxBytes }`), GET/HEAD/OPTIONS are still
skipped, and `DEFAULT_REQUEST_BODY_LIMIT_BYTES` / `RequestBodyLimitOptions` are
unchanged. One-place fix that restores the bound for all migrated routes.
