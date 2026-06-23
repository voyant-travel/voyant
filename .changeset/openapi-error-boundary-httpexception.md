---
"@voyant-travel/hono": patch
---

Map Hono's `HTTPException` onto the framework error contract (voyant#2114).

`.openapi()` routes with a JSON body install Hono's request validator, which
throws `HTTPException(400, "Malformed JSON in request body")` for malformed
client JSON *before* `openApiValidationHook` runs. The shared
`normalizeValidationError` previously only recognized `ApiHttpError` and
`ZodError`, so `handleApiError` fell through to a bare 500 for bad client input
on every migrated `.openapi()` JSON-body route.

`normalizeValidationError` now recognizes `HTTPException` and maps it onto the
framework contract — a 400 becomes a structured `{ code: "invalid_request" }`
4xx, restoring the clean 400 that `parseJsonBody` produced pre-migration. The
fix is one place in the error boundary and benefits all already-migrated routes;
no route or spec changes required.
