---
"@voyantjs/products": minor
"@voyantjs/pricing": patch
---

Booking-engine quote driven by option price rules (#468, Phase C).

The owned-arm products handler in `@voyantjs/products` no longer relies solely on the `product.sellAmountCents × pax` placeholder. It now consults a caller-supplied price resolver to drive per-band pricing from `optionPriceRules` + `optionUnitPriceRules`.

**`@voyantjs/products`** (minor)

- New DI hook `loadResolvedOptionPrice` on `OwnedProductsShapeLoaders`. Takes `{ productId, optionId, date, catalogId? }`, returns `{ baseSellAmountCents, unitPrices }` or null. Caller-supplied so `@voyantjs/products` does not import `@voyantjs/pricing` (the dependency direction is `pricing → products`, not the reverse).
- New DI hook `loadSlotDate` to convert a draft's `departureSlotId` into an ISO date the resolver can match against. Caller-supplied to avoid pulling `@voyantjs/availability` into products.
- New exported types `ResolvedOptionPrice`, `ResolvedUnitPrice`.
- `computeQuote` now picks the price using a three-way fall-through:
  1. **Per-band**: when `unitPrices` matches at least one pax band with positive count, sum `pax[band] × unit.sellAmountCents`. One breakdown line per band.
  2. **Per-booking**: when no band matches, charge `baseSellAmountCents × paxCount`.
  3. **Fallback**: `product.sellAmountCents × paxCount` (Phase A behavior preserved for bookings without an option/slot picked).
- 6 new unit tests covering the matrix above.

**`@voyantjs/pricing`** (patch)

- Re-export `resolveOptionPriceRulesForDate`, `pickRulesForDate`, `loadDeparturePriceOverrides` and supporting types from the package's main entry — they were previously private to internal callers but the booking-engine wiring needs them. No new schema, no migration.

The operator template (`templates/operator/src/api/lib/booking-engine-runtime.ts`) now wires both hooks via the resolver. Per-pax categorization is derived from `optionUnits.minAge`/`maxAge`: `maxAge ≤ 1` → infant, `maxAge ≤ 17` → child, otherwise adult. Operators with senior bands extend per product.
