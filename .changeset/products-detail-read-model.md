---
"@voyantjs/products": minor
---

KV document plane for the public product detail surface (RFC #1687 Phase 2.2). `GET /v1/public/products/:id` and `/slug/:slug` are read-through against the `env.CACHE` KV binding: the first read materializes the render-ready document (per locale variant, 24h TTL); repeat reads cost one KV get and **zero Postgres queries**. Slug lookups resolve through a short-lived slug→id mapping so both routes share one document. Freshness is exact, not TTL-bound: a middleware on the products admin surface drops a product's cached documents after any successful mutation that names it (any route group — core, media, translations, options, itinerary). Deployments without the `CACHE` binding (or KV `list`) degrade to the live path / TTL-bounded freshness. Together with the Typesense-backed browse/search (already serving cards from index documents), the storefront hot path no longer needs Postgres for repeat reads.
