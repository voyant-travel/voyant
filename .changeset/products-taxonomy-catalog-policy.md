---
"@voyantjs/products": minor
---

Part 2 of #493: ship the taxonomy child-entity catalog registry — denormalize product categories (with full ancestor walk) and structured tags onto the product search document.

New surface:

- `productTaxonomyCatalogPolicy` (`@voyantjs/products/catalog-policy-taxonomy`) — `FieldPolicy[]` declaring `categories[]`, `categoryIds[]`, `categorySlugs[]`, `primaryCategoryId`, `primaryCategoryName`, `primaryCategorySlug`, `tagLabels[]`, `tagIds[]`. Compose with `productCatalogPolicy` via `createFieldPolicyRegistry([...productCatalogPolicy, ...productTaxonomyCatalogPolicy])`.
- `createProductTaxonomyProjectionExtension` (`@voyantjs/products/service-catalog-plane-taxonomy`) — runtime extension that joins `product_category_products` → `product_categories` (walking the parent chain so a leaf-only link surfaces every active ancestor) and `product_tag_products` → `product_tags`. Inactive categories/ancestors are excluded so an operator-paused parent stops surfacing children under the parent filter. Primary category = the lowest-`sortOrder` direct link, ties broken by name.
- New `category` and `tag` axis values on `ProductContentChangedEvent`, emitted from the four product → category and product → tag link-mutation routes in `routes.ts`. Without these, the catalog bridge would not reindex on link changes and the new fields would silently go stale.

Hierarchy denormalization is the load-bearing part of this PR: Typesense can't recurse, so a product linked to "Hiking" (parent: "Adventure") needs both labels in `categories[]` for an "Adventure" filter to match a single equality. The extension walks the chain iteratively (bounded by tree depth, cycle-protected) instead of relying on a recursive CTE — keeps the join inside Drizzle and the unit-test surface a pure function.

Wired into the operator template (`templates/operator/src/api/lib/catalog-runtime.ts`): the `products` registry now includes taxonomy paths, and `createProductsDocumentBuilder` runs both the destinations and taxonomy extensions on every product reindex (live + bulk paths share the same builder per the PR #499 fix).

Out of scope here, tracked as follow-ups:

- Locale-aware category/tag names. `product_categories.name` and `product_tags.name` are single columns today (no `category_translations`/`tag_translations` tables). All fields ship `localized: false` until a schema migration with backfill lands. Tracked in #502.
- `priceFrom` (PR4) and departures aggregations (PR3) per the #493 plan.
