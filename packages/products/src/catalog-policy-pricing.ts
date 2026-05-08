/**
 * Catalog plane field policy for product → pricing denormalization.
 *
 * Aggregates a "price from" value across the product's configured
 * default-rule prices so storefront cards can render `from $X` without
 * fanning out to per-option pricing on every render. See
 * `docs/architecture/catalog-architecture.md` §5.4.
 *
 * Storefront product cards filter and display by:
 *   - "trips under $1000" (filter: `priceFromAmountCents` <= 100000)
 *   - badge "from $X" (display: `priceFromAmountCents` + `priceFromCurrency`)
 *   - sort by price ascending (`priceFromAmountCents` asc)
 *
 * Wire this policy into the products registry by composing with
 * `productCatalogPolicy`:
 *
 *   const registry = createFieldPolicyRegistry([
 *     ...productCatalogPolicy,
 *     ...productPricingCatalogPolicy,
 *   ])
 *
 * and wire `createProductPricingProjectionExtension` (from
 * `@voyantjs/pricing/service-catalog-plane-pricing`) into
 * `createProductDocumentBuilder` so the values land in the doc.
 *
 * Why a separate field instead of reusing the existing `sellAmountCents`
 * from `productCatalogPolicy`: that path projects the product-row
 * configured default verbatim. Multi-option products often leave
 * `products.sellAmountCents` null and put the real prices on options —
 * this projection MINs across both, giving storefront a value that's
 * always meaningful even for the option-driven case.
 *
 * Out of scope here (deferred):
 *   - Schedule-aware rule resolution. The kernel reads `isDefault=true`
 *     rule prices only — it does NOT walk seasonal schedules, per-
 *     departure overrides, or per-unit occupancy tiers. A "true cheapest
 *     bookable price right now" projection requires per-slice rule
 *     evaluation with a moving "now" date and is a follow-up.
 *   - Per-audience / per-market currency conversion. The currency we
 *     emit is `products.sellCurrency`; multi-catalog operators using
 *     mixed currencies for the same product will see prices clipped
 *     to the rules matching that currency.
 *   - `pricing.changed` event surface. Today, edits to option-price
 *     rules don't fire any event, so the bridge can only reindex on
 *     `product.updated`. Tracked separately.
 */

import { defineFieldPolicy, type FieldPolicyInput } from "@voyantjs/catalog/contract"

const PRODUCT_PRICING_FIELD_POLICY: FieldPolicyInput[] = [
  // ── Aggregated "price from" amount ───────────────────────────────────────
  // MIN across `products.sellAmountCents` and the active default
  // `optionPriceRules.baseSellAmountCents` (plus option-unit-rule MINs for
  // per-unit-priced options). `null` when no source has a non-null amount.
  {
    path: "priceFromAmountCents",
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
  // ── Currency for the projected amount ────────────────────────────────────
  // `products.sellCurrency`. Stays consistent across all rule sources for
  // the projected product because we filter rule rows to ones matching
  // this currency before MIN'ing.
  {
    path: "priceFromCurrency",
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
  // ── Existence flag ───────────────────────────────────────────────────────
  // `false` when neither the product row nor any active default rule has a
  // configured price. Storefront filters use this for "show only priced
  // products" and to suppress an empty `from` badge.
  {
    path: "hasPricing",
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
 * Resolved pricing policy. Compose with `productCatalogPolicy` when
 * building the products registry.
 */
export const productPricingCatalogPolicy = defineFieldPolicy(PRODUCT_PRICING_FIELD_POLICY)

export { PRODUCT_PRICING_FIELD_POLICY }
