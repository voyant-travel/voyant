/**
 * Catalog plane field policy for product → promotional-offer denormalization.
 *
 * Promotions are projected as **annotations only** — this policy does NOT
 * touch the existing `priceFromAmountCents` field (that's emitted by the
 * pricing extension and the two extensions can't read each other's output;
 * see `docs/architecture/promotions-architecture.md` §3.7). Instead, we
 * emit `bestOffer*` + `originalPriceFromAmountCents` and storefront
 * consumers compute the effective price client-side:
 *
 *   effective = bestOfferDiscountKind === "percentage"
 *     ? round(price × (1 - bestOfferDiscountPercent/100))
 *     : price - bestOfferDiscountAmountCents
 *
 * Catalog filter / sort behavior continues to use `priceFromAmountCents`
 * (the list price). A customer searching `< $200` won't find a
 * `$250 → $180` discounted product via the filter — acknowledged v1
 * limitation, see §15.1 of the architecture doc.
 *
 * Conditional offers are surfaced separately so storefront cards can
 * render hints like "From 4 pax: extra 5% off" — the catalog plane
 * doesn't know pax at index time, so any offer with a `minPax` condition
 * lands here instead of in `bestOffer*`.
 *
 * Wire this policy into the products registry by composing with
 * `productCatalogPolicy`:
 *
 *   const registry = createFieldPolicyRegistry([
 *     ...productCatalogPolicy,
 *     ...productPromotionsCatalogPolicy,
 *   ])
 *
 * and wire `createProductPromotionsProjectionExtension` (from
 * `@voyantjs/promotions/service-catalog-plane-promotions`) into
 * `createProductDocumentBuilder` so the values land in the doc.
 *
 * Out of scope here:
 *   - Localized offer names. Offers are operator-managed in one language
 *     for v1 (`localized: false`); a `promotional_offer_translations`
 *     table mirrors `destinations_translations` if/when needed.
 *   - Discount-aware filter / sort. Requires the §15.1 ordered-extensions
 *     contract change; deferred.
 */

import { defineFieldPolicy, type FieldPolicyInput } from "@voyantjs/catalog/contract"

const PRODUCT_PROMOTIONS_FIELD_POLICY: FieldPolicyInput[] = [
  // ── Best-offer existence flag ────────────────────────────────────────────
  // Storefront filters use this for "show only products on sale" and to
  // suppress an empty badge.
  {
    path: "hasOffer",
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
  // ── Best-offer ID ────────────────────────────────────────────────────────
  // Used for deep-linking from a search card to the offer-detail page.
  {
    path: "bestOfferId",
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
  // ── Best-offer name (display) ────────────────────────────────────────────
  // Single-locale in v1 — see file-header notes.
  {
    path: "bestOfferName",
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
  // ── Best-offer discount kind ─────────────────────────────────────────────
  // `"percentage"` | `"fixed_amount"` | `null`. Drives storefront's badge
  // rendering (% vs $).
  {
    path: "bestOfferDiscountKind",
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
  // ── Best-offer percentage (when kind = percentage) ───────────────────────
  {
    path: "bestOfferDiscountPercent",
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
  // ── Best-offer cents off (when kind = fixed_amount) ──────────────────────
  {
    path: "bestOfferDiscountAmountCents",
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
  // ── Original (un-discounted) price ───────────────────────────────────────
  // Populated only when an offer applies (so consumers know what to
  // strike through). When `null`, no offer applies and consumers should
  // render `priceFromAmountCents` plain.
  {
    path: "originalPriceFromAmountCents",
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

  // ── Conditional-offer existence flag ─────────────────────────────────────
  // Surfaced when an offer has a `minPax` condition the catalog plane
  // can't satisfy at index time. Storefront uses this for the "From N
  // pax: extra X% off" hint.
  {
    path: "hasConditionalOffer",
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
    path: "conditionalOfferId",
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
    path: "conditionalOfferName",
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
    path: "conditionalOfferDiscountKind",
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
    path: "conditionalOfferDiscountPercent",
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
    path: "conditionalOfferDiscountAmountCents",
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
  // ── Conditional-offer minPax threshold ───────────────────────────────────
  // Drives the "From N pax" message text.
  {
    path: "conditionalOfferMinPax",
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
 * Resolved promotions policy. Compose with `productCatalogPolicy` when
 * building the products registry.
 */
export const productPromotionsCatalogPolicy = defineFieldPolicy(PRODUCT_PROMOTIONS_FIELD_POLICY)

export { PRODUCT_PROMOTIONS_FIELD_POLICY }
