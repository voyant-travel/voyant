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
 * Localization (#502): `product_category_translations` and
 * `product_tag_translations` tables back the locale-aware label fields.
 * Slice-locale rows win; if no row exists for the slice, the projection
 * falls back to the canonical `productCategories.name` /
 * `productTags.name`. Slug stays single-locale on `productCategories.slug`
 * (per #502 non-goals — operators want stable URLs that don't shift when
 * translations are edited).
 *
 * Out of scope here:
 *   - Per-locale slugs. One canonical slug per category.
 *   - Tag hierarchy. Tags are flat by design.
 */

import { defineFieldPolicy, type FieldPolicyInput } from "@voyantjs/catalog/contract"

const PRODUCT_TAXONOMY_FIELD_POLICY: FieldPolicyInput[] = [
  // ── Category labels (denormalized with ancestors, locale-aware) ──────────
  // One entry per category in the linked-category-plus-ancestors set, deduped.
  // A product linked to "Hiking" (parent: "Adventure") emits both
  // ["Hiking", "Adventure"] so any-level filter matches a single equality.
  // Locale-keyed since #502 — falls back to canonical name when no
  // translation exists for the slice's locale.
  {
    path: "categories[]",
    class: "structural",
    merge: "source-only",
    drift: "low",
    reindex: "entry-locale",
    snapshot: "on-book",
    query: "indexed-column",
    localized: true,
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
    // Locale-aware since #502 — the primary's name follows the same
    // translation lookup as `categories[]`.
    path: "primaryCategoryName",
    class: "structural",
    merge: "source-only",
    drift: "low",
    reindex: "entry-locale",
    snapshot: "on-book",
    query: "indexed-column",
    localized: true,
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
    // Locale-aware since #502 — falls back to canonical `productTags.name`
    // when no `product_tag_translations` row exists for the slice's locale.
    path: "tagLabels[]",
    class: "structural",
    merge: "source-only",
    drift: "low",
    reindex: "entry-locale",
    snapshot: "on-book",
    query: "indexed-column",
    localized: true,
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
