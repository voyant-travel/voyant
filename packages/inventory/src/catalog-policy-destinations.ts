/**
 * Catalog plane field policy for product → destination denormalization.
 *
 * These fields don't live on the `products` table — they're joined from
 * `product_destinations` → `destinations` (+ `destination_translations` for
 * locale-aware names) at index time and projected onto the product search
 * document. See `docs/architecture/catalog-architecture.md` §5.4 — the
 * search index is the canonical place for cross-entity denormalization.
 *
 * Storefront product cards filter and display by destinations:
 *   - "trips to Italy" (filter: `countries[]` includes "Italy")
 *   - "trips in Rome" (filter: `cities[]` includes "Rome")
 *   - "Mediterranean cruises" (filter: `regions[]` includes "Mediterranean")
 *   - "cruises from Amsterdam" (filter: `ports[]` or canonical place ids)
 *
 * Wire this policy into the products registry by composing with
 * `productCatalogPolicy`:
 *
 *   const registry = createFieldPolicyRegistry([
 *     ...productCatalogPolicy,
 *     ...productDestinationsCatalogPolicy,
 *   ])
 *
 * and wire `createProductDestinationsProjectionExtension` into
 * `createProductDocumentBuilder` so the values land in the doc.
 *
 * Destination rows can carry canonical place ids (for example UN/LOCODE)
 * and optional display coordinates. The gazetteer itself remains external;
 * this module stores stable pointers/snapshots for faceting.
 *
 * Out of scope here:
 *   - Slug fields per locale. Destinations have one canonical slug today;
 *     locale-specific slugs are a follow-up if marketing needs them.
 */

import { defineFieldPolicy, type FieldPolicyInput } from "@voyantjs/catalog/contract"

const PRODUCT_DESTINATIONS_FIELD_POLICY: FieldPolicyInput[] = [
  // ── Locale-aware destination labels ──────────────────────────────────────
  // Sourced from `destination_translations` (falls back to `destinations.slug`
  // when no translation exists for the slice's locale). One array entry per
  // linked destination of the matching `destination_type`.
  {
    path: "regions[]",
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
    path: "countries[]",
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
    path: "cities[]",
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
    path: "ports[]",
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
    path: "waterways[]",
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

  // ── Slugs (locale-stable) ────────────────────────────────────────────────
  // Used for category-page links — operators want stable URLs that don't
  // shift when translations are edited. One entry per linked destination.
  {
    path: "destinationSlugs[]",
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

  // ── Destination IDs ──────────────────────────────────────────────────────
  // Useful for filtering by exact destination match (e.g. landing pages
  // pinned to a destination ID rather than a slug).
  {
    path: "destinationIds[]",
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
    path: "destinationCanonicalPlaceIds[]",
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
 * Resolved destinations policy. Compose with `productCatalogPolicy` when
 * building the products registry.
 */
export const productDestinationsCatalogPolicy = defineFieldPolicy(PRODUCT_DESTINATIONS_FIELD_POLICY)

export { PRODUCT_DESTINATIONS_FIELD_POLICY }
