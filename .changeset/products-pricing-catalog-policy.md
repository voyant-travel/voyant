---
"@voyantjs/products": minor
"@voyantjs/pricing": minor
---

Part 4 of #493: ship the pricing child-entity catalog registry — denormalize a `priceFromAmountCents` value across the product's configured default-rule prices so storefront cards can render `from $X` and filter by price range without fanning out to per-option pricing on every render.

New surface (`@voyantjs/products`):

- `productPricingCatalogPolicy` (`@voyantjs/products/catalog-policy-pricing`) — `FieldPolicy[]` declaring `priceFromAmountCents`, `priceFromCurrency`, `hasPricing`. Compose via `createFieldPolicyRegistry([...productCatalogPolicy, ...productPricingCatalogPolicy])`.

New surface (`@voyantjs/pricing`):

- `createProductPricingProjectionExtension` (`@voyantjs/pricing/service-catalog-plane-pricing`) — runtime extension that MINs across `products.sellAmountCents`, the active default `optionPriceRules.baseSellAmountCents`, and the active default `optionUnitPriceRules.sellAmountCents`, filtered to rules whose catalog currency matches the product's `sellCurrency` (or whose catalog currency is null and therefore inherits). `loadProductPricing` is pluggable for testing.

Why a separate `priceFromAmountCents` field (vs. reusing `sellAmountCents` from the base policy): the base policy projects the row-level configured default verbatim. Multi-option products commonly leave `products.sellAmountCents` null and put the real prices on options — the new field MINs across both, giving storefront a value that's always meaningful even for option-driven products.

Why the projection lives in `@voyantjs/pricing` (not products): the data lives there, and `pricing` already depends on `products`. The reverse import would create a circular dep — same architectural decision as PR3's departures projection in `@voyantjs/availability`.

Operator template:

- Composes `productPricingCatalogPolicy` into the products registry alongside destinations, taxonomy, departures.
- `createProductsDocumentBuilder` runs the pricing extension on every product reindex.

Behavior decisions:

- **Static rules only.** Only `is_default = true AND active = true` rules contribute. Schedule-aware rules (seasonal, promo) and per-departure overrides are excluded. A "true cheapest bookable price right now" projection requires per-slice rule evaluation against a moving "now" date and is deferred.
- **Currency consistency.** Only rules in catalogs matching the product's currency (or with a null catalog currency, which inherits) are MIN'd together. This prevents emitting a misleading "from $50" when one rule is actually €50.
- **Document churn.** `now()`-independent — same product reindexed an hour later produces identical fields.

Out of scope (tracked):

- `pricing.changed` event surface. Today, edits to option-price rules don't fire any event, so the catalog bridge can only reindex on `product.updated`. Tracked in #505.
- Schedule-aware rule resolution + per-departure overrides. Same operational concern as above plus per-slice resolution complexity.
