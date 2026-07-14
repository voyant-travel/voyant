# Travel credits, promotions, and service vouchers

These concepts use different lifecycles and belong to different modules. Their
names must stay distinct in schemas, APIs, events, and user interfaces.

## Canonical model

| Concept | Owner | Meaning |
| --- | --- | --- |
| Travel Credit | Finance | Currency-denominated stored value with an issued balance and an immutable redemption ledger. |
| Promotion | Commerce | A pricing rule that reduces a quoted price when its conditions match. |
| Promotion Code | Commerce | A customer-entered code that activates a Promotion. It does not carry value. |
| Service Voucher | Bookings | A fulfillment artifact authorizing a Traveler to consume a booked supplier service. |

Applying a Promotion changes the price. Redeeming a Travel Credit records a
payment against the amount due. Issuing a Service Voucher fulfills a Booking
Item. A single Booking may use all three independently.

## Finance: Travel Credits

Finance owns Travel Credit issuance, validity, balances, and redemptions. The
public vocabulary is `travel-credit` / `travel_credit` / `TravelCredit`, as
appropriate for the surface.

- Tables: `travel_credits`, `travel_credit_redemptions`
- Admin API: `/v1/admin/finance/travel-credits`
- Public validation API: `/v1/public/finance/travel-credits/validate`
- Booking input: `travelCreditRedemption`
- Package setup runtime: `@voyant-travel/finance/setup/travel-credits`

Travel Credit source types describe why stored value was issued. `promotion`
means a Commerce Promotion caused the issuance; it does not make the Travel
Credit a discount or Promotion Code. Promotional pricing remains
Commerce-owned.

Redemption commands require an idempotency key. Finance stores it with the
immutable redemption row and rejects reuse with a different booking, payment,
or amount.

## Commerce: Promotions

Commerce owns Promotion evaluation and Promotion Code redemption. A Promotion
may be automatic or code-gated. It records the discount applied to a Booking,
never a monetary balance or payment.

Do not introduce `coupon` as a parallel first-party noun. If product language
later needs coupons with distinct lifecycle or distribution semantics, model
that distinction explicitly rather than aliasing Promotion Codes.

## Bookings: Service Vouchers

Bookings owns supplier-facing and traveler-facing fulfillment artifacts. Use
`service_voucher` where a fulfillment type needs a machine-readable value and
use `Service Voucher` in UI copy.

A supplier confirmation reference is not automatically a Service Voucher. Keep
the reference on supplier status when it only identifies an upstream booking;
create a fulfillment when an artifact is actually issued.

## Compatibility policy

This boundary is being corrected during the `0.x` beta and is intentionally a
breaking public rename. Do not add duplicate HTTP routes, request fields,
TypeScript aliases, or package exports for the old Finance vocabulary.

Persisted data is different: package migrations must rename existing tables,
columns, constraints, indexes, and enum types in place. The historical
`payment_instruments.instrument_type = 'voucher'` value may appear only in the
idempotent setup migration that imports those legacy rows as Travel Credits.
Historical migration SQL and immutable setup-migration IDs are allowed to keep
their original wording.
