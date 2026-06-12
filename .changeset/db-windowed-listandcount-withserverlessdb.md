---
"@voyantjs/db": minor
---

- `createCrudService(...).listAndCount` now runs **one** query instead of two: the total rides along as a `count(*) OVER ()` window column (stripped from returned rows). Results are identical, including soft-delete filtering and the offset-past-end case (which falls back to a count query). On per-query transports (neon-http) this halves the roundtrips and subrequests of every list endpoint.
- New `withServerlessDb(connectionString, fn, options?)`: runs `fn` with a scoped transaction-capable Neon WebSocket client and disposes it on settle — for event handlers, workflow steps, scheduled jobs, and scripts that need `db.transaction(...)` outside the request middleware.
