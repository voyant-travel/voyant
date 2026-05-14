# @voyantjs/promotions

Promotional offers for Voyant — auto-applied catalog discounts (badges, strikethrough prices), code-redeemed discounts at checkout, and audience- / market-scoped blanket discounts. Resolves issue #497.

PR1 ships the schema + admin CRUD only. Catalog plane wiring lands in PR3, booking-engine integration in PR4. See `docs/architecture/promotions-architecture.md` for the full design.

Storefront runtimes can wire `createPromotionsStorefrontResolvers()` into
`@voyantjs/storefront` to expose:

- `GET /v1/public/products/:productId/offers`
- `GET /v1/public/offers/:slug`
- `POST /v1/public/offers/:slug/apply`
- `POST /v1/public/offers/redeem`

Manual and code-gated offers use the same evaluator as quote-time pricing:
best non-stackable discount wins, and explicitly stackable offers compose when
the selected path is stackable. Public mutation responses include conflict
metadata without leaking internal rule details.

## Install

```bash
pnpm add @voyantjs/promotions
```

## Usage

```typescript
import { promotionsModule } from "@voyantjs/promotions"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [promotionsModule],
  // ...
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export (`promotionsModule`, `promotionsHonoModule`) |
| `./schema` | Drizzle tables (`promotionalOffers`, `promotionalOfferProducts`, `promotionalOfferRedemptions`) |
| `./validation` | Zod schemas (insert / update / scope discriminator / conditions) |
| `./routes` | Hono admin routes mounted at `/v1/admin/promotions/*` |
| `./events` | `PROMOTION_CHANGED_EVENT` + payload types |
| `./service` | `promotionsService` (CRUD + scope materialization) |
| `./service-storefront` | Storefront offer discovery, apply, and redeem resolver factory |

## License

Apache-2.0
