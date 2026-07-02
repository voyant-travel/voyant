---
"@voyant-travel/hono": patch
"@voyant-travel/openapi": patch
---

Add `servers`, `operationId`, and `summary` to generated OpenAPI specs (#2729).

Completes the metadata Redocly/Swagger tooling expects:

- **`servers`** — a relative `[{ url: "/" }]` entry so "try it out" targets the
  origin the deployment serves the contract from (overridable per deployment).
- **`operationId`** — a stable camelCase id derived from method + path
  (`GET /v1/admin/bookings/{id}` → `getAdminBookingsById`), unique per document,
  so generated clients get readable, deterministic method names.
- **`summary`** — the method + path signature on every operation, so viewers
  and linters have a title for each.

All three are stamped by `stampModuleMetadata` and are non-destructive — a value
a route already declares (e.g. a hand-authored `summary`) is never overwritten.
