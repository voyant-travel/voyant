---
"@voyantjs/promotions": minor
"@voyantjs/db": patch
---

Initial release of `@voyantjs/promotions` — PR1 of #497.

Ships the schema + admin CRUD foundation for promotional offers (auto-applied catalog discounts, code-redeemed discounts at checkout, and audience- / market-scoped blanket discounts). Catalog-plane wiring lands in PR3 with the boundary scheduler; booking-engine integration in PR4. Full design in `docs/architecture/promotions-architecture.md`.

This PR adds:

- Three tables — `promotional_offers`, `promotional_offer_products` (denormalized scope materialization for `products` / `categories` / `destinations` scopes), `promotional_offer_redemptions` (per-`(offer, booking)` audit row with idempotent unique constraint).
- TypeID prefixes `pofr` (`promotional_offers`) and `pofx` (`promotional_offer_redemptions`) in `@voyantjs/db`.
- Discriminated-union scope schema with six variants: `global`, `products`, `categories`, `destinations`, `markets`, `audiences`. No `channels` variant in v1 — see §3.2 of the architecture doc.
- CRUD service (`listOffers`, `getOfferById`, `createOffer`, `updateOffer`, `archiveOffer`, `deleteOffer`) with optional `OfferMutationRuntime.eventBus` to emit `promotion.changed`. Service-layer pre-check on delete returns a clearer error than the raw FK RESTRICT when redemptions exist.
- Scope materialization (`recomputeOfferLinks`): write-time expansion of `categories` and `destinations` scopes to product IDs via `@voyantjs/products` link tables; slice-shaped scopes (`global`, `markets`, `audiences`) leave the link table empty.
- Admin routes mounted at `/v1/admin/promotions/*` (auto-mounted by `createApp` based on `module.name`).
- 30 unit tests + 17 integration tests.

Operator template now ships the migration and the route mount.
