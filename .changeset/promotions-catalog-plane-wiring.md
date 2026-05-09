---
"@voyantjs/promotions": minor
"@voyantjs/products": minor
"@voyantjs/db": patch
---

PR3 of #497: catalog-plane wiring + boundary scheduler.

Storefront cards now render badges + strikethrough prices automatically when an active offer applies to a product. Offers fire at `valid_from` / expire at `valid_until` within ~5 minutes of the boundary (every-5-min cron in the operator template).

This PR adds:

**`@voyantjs/products`** — new `productPromotionsCatalogPolicy` (in `./catalog-policy-promotions`) declaring 14 annotation fields the products search document picks up: `hasOffer`, `bestOfferId`, `bestOfferName`, `bestOfferDiscountKind`, `bestOfferDiscountPercent`, `bestOfferDiscountAmountCents`, `originalPriceFromAmountCents`, plus the matching `conditionalOffer*` set for "From N pax: extra X% off" hints. Visibility `[staff, customer, partner]`.

**`@voyantjs/promotions`** —
- `./service-catalog-plane-promotions` — `createProductPromotionsProjectionExtension()`. Annotation-only contract per §3.7: does NOT touch `priceFromAmountCents`. Storefront consumers compute the effective price client-side. `loadOriginalPrice` callback lets templates wire a richer MIN-across-options resolver for option-driven products; default reads `products.sell_amount_cents`.
- `./service-boundary-scheduler` — `runPromotionBoundaryScheduler({ db, eventBus? })`. Scans `promotional_offers` for `valid_from` / `valid_until` crossings since the persisted watermark, returns the `BoundaryCrossing[]` so cron handlers without an in-process bus can dispatch the reindex inline (Cloudflare scheduled handlers don't share an `EventBus` with the running app's catalog-bridge). New `promotional_offer_scheduler_state` watermark table (single row, sentinel-keyed for defense). New typeid `pofs`.
- `createDrizzleOfferDataSource` (PR2) widened from `PostgresJsDatabase` to `AnyDrizzleDb` so the projection extension can use it from the products document builder's call site.

**`@voyantjs/db`** — new `pofs` typeid prefix for `promotional_offer_scheduler_state`.

**Operator template** —
- Schema added to `drizzle.config.ts`; migration `0007_oval_hex.sql` generated.
- `catalog-runtime.ts` composes `productPromotionsCatalogPolicy` + `createProductPromotionsProjectionExtension()` into the products registry / builder.
- `catalog-bridge.ts` subscribes to `promotion.changed` — reindexes the affected products on offer mutations + scheduler firings. `affected.kind: "all"` is logged + skipped (bulk-reindex API on `IndexerService` is a future enhancement; in practice global / market / audience scope changes are operator-rare).
- New `src/api/promotion-scheduled.ts` cron handler (`*/5 * * * *`) — runs the scheduler, then reindexes the unique product set across all crossings via the same indexer code path the live bridge uses.
- `wrangler.jsonc` adds the cron; `entry.ts` dispatches it.

10 new unit tests + 9 new integration tests. 76 unit tests pass, 26 integration tests skipped without `TEST_DATABASE_URL`.

**Known v1 limitations** (per §15 / §14 of the architecture doc):
- Catalog filter / sort uses `priceFromAmountCents` (list price) rather than effective price — `bestOffer*` annotations don't change which products match a `< $200` filter when a product is on sale. Real fix is the §15.1 ordered-extensions contract change, deferred.
- `affected.kind: "all"` reindex pathway is a no-op until `IndexerService` grows a bulk-reindex helper.
