---
"@voyantjs/products": minor
---

Public catalog read hardening for storefront load (#1686).

**Behavior change — trimmed list payloads:** `GET /v1/public/products` no longer returns richtext content fields per product. `inclusionsHtml`, `exclusionsHtml` and `termsHtml` are now `null` on list responses, and `description` is capped at 500 characters. The response keys are unchanged (fields are nulled, not removed), so schema-validating clients keep parsing. Detail lookups (`GET /v1/public/products/:id` and `/slug/:slug`) still return the full content. Clients that need full content in a list can opt in with `?includeContent=true` (which also attaches the detail-only `media`/`features`/`faqs`/`brochure` collections).

**Pagination caps:** the public products list now defaults to `limit=20`, and all public list endpoints (products, categories, tags, destinations) clamp `limit` into `[1, 100]` instead of rejecting out-of-range values with a 400. Malformed limits fall back to the default.

**Cache headers:** successful responses from the public catalog GET endpoints (products list, product detail by id and slug, brochure, categories, tags, destinations) now send `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` so CDNs can absorb storefront read traffic. Error and 404 responses are not cached.
