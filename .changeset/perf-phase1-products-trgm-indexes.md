---
"@voyantjs/products": patch
---

Trigram GIN indexes for every `ILIKE '%term%'` search path: `products(name, description)`, `product_tags(name)`, `product_categories(name, slug)`, `destination_translations(name, description)`, `product_locations(title, city)` — admin list search and the public catalog search stop seq-scanning. **Requires the `pg_trgm` Postgres extension** (`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`); the operator template's `0061_perf_phase1_indexes` migration enables it, but self-hosted deployments applying schema by other means must enable it themselves (it ships with stock Postgres, no install needed).
