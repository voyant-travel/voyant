---
"@voyant-travel/hono": patch
---

Honor the `search` action for API-key/staff scopes on `POST /v1/<surface>/*/search` routes. Search endpoints are exposed as POST (complex bodies) but are read-family operations, so a token scoped `catalog:search`/`catalog:read` was previously rejected with 403 on `POST /v1/admin/catalog/search`. Non-search POST routes (product writes, bookings, pricing, …) stay gated on their normal write actions.
