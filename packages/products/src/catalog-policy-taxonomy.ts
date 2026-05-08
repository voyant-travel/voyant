/**
 * Catalog plane field policy for product → taxonomy denormalization
 * (categories + tags).
 *
 * These fields don't live on the `products` table — they're joined from
 * `product_category_products` → `product_categories` (with parent walk for
 * hierarchy denormalization) and `product_tag_products` → `product_tags` at
 * index time and projected onto the product search document. See
 * `docs/architecture/catalog-architecture.md` §5.4 — the search index is the
 * canonical place for cross-entity denormalization.
 *
 * Storefront product cards filter and display by taxonomy:
 *   - "Adventure tours" (filter: `categories[]` includes "Adventure")
 *   - A product tagged "Hiking" (parent "Adventure") MUST also surface under
 *     the "Adventure" filter — Typesense can't recurse, so the projection
 *     denormalizes the full ancestor chain into `categories[]` /
 *     `categoryIds[]`.
 *   - "Family-friendly" (filter: `tags[]` includes "Family-friendly")
 *
 * Wire this policy into the products registry by composing with
 * `productCatalogPolicy`:
 *
 *   const registry = createFieldPolicyRegistry([
 *     ...productCatalogPolicy,
 *     ...productTaxonomyCatalogPolicy,
 *   ])
 *
 * and wire `createProductTaxonomyProjectionExtension` into
 * `createProductDocumentBuilder` so the values land in the doc.
 *
 * Out of scope here:
 *   - Locale-aware names. `product_categories.name` and `product_tags.name`
 *     are single columns today (no `category_translations` / `tag_translations`
 *     tables). Adding locale support needs a schema migration with backfill
 *     and is tracked as a follow-up. Until then, these fields ship
 *     `localized: false` and the same name lands on every locale slice.
 *   - Tag hierarchy. Tags are flat by design.
 */

import { defineFieldPolicy, type FieldPolicyInput } from "@voyantjs/catalog/contract"

const PRODUCT_TAXONOMY_FIELD_POLICY: FieldPolicyInput[] = [
  // ── Category labels (denormalized with ancestors) ────────────────────────
  // One entry per category in the linked-category-plus-ancestors set, deduped.
  // A product linked to "Hiking" (parent: "Adventure") emits both
  // ["Hiking", "Adventure"] so any-level filter matches a single equality.
  {
    path: "categories[]",
    class: "structural",
    merge: "source-only",
    drift: "low",
    reindex: "facet-affecting",
    snapshot: "on-book",
    query: "indexed-column",
    localized: false,
    visibility: ["staff", "customer", "partner"],
    editRole: "none",
    overrideFriction: "none",
    sourceFreshness: "sync",
  },

  // ── Category IDs (denormalized with ancestors) ───────────────────────────
  // Same denormalization as `categories[]` but for ID-based filters
  // (landing pages pinned to a category id rather than a label).
  {
    path: "categoryIds[]",
    class: "structural",
    merge: "source-only",
    drift: "low",
    reindex: "facet-affecting",
    snapshot: "on-book",
    query: "indexed-column",
    localized: false,
    visibility: ["staff", "customer", "partner"],
    editRole: "none",
    overrideFriction: "none",
    sourceFreshness: "sync",
  },

  // ── Category slugs (locale-stable, denormalized with ancestors) ──────────
  // Storefront category-page links want stable URLs that don't shift when
  // labels are edited. `product_categories.slug` exists today.
  {
    path: "categorySlugs[]",
    class: "structural",
    merge: "source-only",
    drift: "low",
    reindex: "facet-affecting",
    snapshot: "on-book",
    query: "indexed-column",
    localized: false,
    visibility: ["staff", "customer", "partner"],
    editRole: "none",
    overrideFriction: "none",
    sourceFreshness: "sync",
  },

  // ── Primary category (single, for badge display) ─────────────────────────
  // Picked as the directly-linked category with the lowest sortOrder on
  // `product_category_products` (the operator-controlled per-product
  // ordering); ties broken by category name. Ancestors are NOT considered
  // for primary — operators pin a leaf via the link table. Null when the
  // product has no category links.
  {
    path: "primaryCategoryId",
    class: "structural",
    merge: "source-only",
    drift: "low",
    reindex: "facet-affecting",
    snapshot: "on-book",
    query: "indexed-column",
    localized: false,
    visibility: ["staff", "customer", "partner"],
    editRole: "none",
    overrideFriction: "none",
    sourceFreshness: "sync",
  },
  {
    path: "primaryCategoryName",
    class: "structural",
    merge: "source-only",
    drift: "low",
    reindex: "facet-affecting",
    snapshot: "on-book",
    query: "indexed-column",
    localized: false,
    visibility: ["staff", "customer", "partner"],
    editRole: "none",
    overrideFriction: "none",
    sourceFreshness: "sync",
  },
  {
    path: "primaryCategorySlug",
    class: "structural",
    merge: "source-only",
    drift: "low",
    reindex: "facet-affecting",
    snapshot: "on-book",
    query: "indexed-column",
    localized: false,
    visibility: ["staff", "customer", "partner"],
    editRole: "none",
    overrideFriction: "none",
    sourceFreshness: "sync",
  },

  // ── Tag labels ───────────────────────────────────────────────────────────
  // `products.tags` (a free-form `text[]` column) already projects to
  // `tags[]` from the base product policy. The structured `product_tags`
  // table is a separate, normalized taxonomy — its labels land here under
  // `tagLabels[]` to avoid colliding with the legacy column. One entry per
  // linked tag.
  {
    path: "tagLabels[]",
    class: "structural",
    merge: "source-only",
    drift: "low",
    reindex: "facet-affecting",
    snapshot: "on-book",
    query: "indexed-column",
    localized: false,
    visibility: ["staff", "customer", "partner"],
    editRole: "none",
    overrideFriction: "none",
    sourceFreshness: "sync",
  },
  {
    path: "tagIds[]",
    class: "structural",
    merge: "source-only",
    drift: "low",
    reindex: "facet-affecting",
    snapshot: "on-book",
    query: "indexed-column",
    localized: false,
    visibility: ["staff", "customer", "partner"],
    editRole: "none",
    overrideFriction: "none",
    sourceFreshness: "sync",
  },
]

/**
 * Resolved taxonomy policy. Compose with `productCatalogPolicy` when
 * building the products registry.
 */
export const productTaxonomyCatalogPolicy = defineFieldPolicy(PRODUCT_TAXONOMY_FIELD_POLICY)

export { PRODUCT_TAXONOMY_FIELD_POLICY }
