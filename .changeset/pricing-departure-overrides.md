---
"@voyantjs/pricing": minor
"@voyantjs/pricing-react": minor
"@voyantjs/i18n": patch
---

First-class per-departure price overrides (#467).

Operators can now opt a single departure out of the seasonal `priceSchedule` layer by setting an explicit per-unit price. Resolved at snapshot time before option price rules: a unit with an active override on a given departure gets that override's amount; units without an override fall through to the schedule-matched rule.

**`@voyantjs/pricing`**

- New `departure_price_overrides` table (TypeID prefix `dpov`). One row per `(departureId × optionUnitId × priceCatalogId)` with `sellAmountCents`, optional `costAmountCents`, `active` flag, `notes`, `metadata`.
- Service + admin REST CRUD at `/v1/admin/pricing/departure-overrides`.
- New `loadDeparturePriceOverrides` helper in `service-rule-resolver`.
- Public pricing snapshot consumes overrides when `departureId` is passed: per-unit `sellAmountCents` is replaced for matching units. Backward-compatible — without `departureId`, the snapshot is unchanged.
- Migrations shipped for the `operator` and `dmc` templates.
- 5 integration tests covering: override beats unit price for the targeted unit, falls through when absent, respects `active=false`, multi-unit overrides coexist, no overrides applied when `departureId` is omitted.

**`@voyantjs/pricing-react`**

- New hooks: `useDeparturePriceOverrides`, `useDeparturePriceOverride`, `useDeparturePriceOverrideMutation`.
- New query options: `getDeparturePriceOverridesQueryOptions`, `getDeparturePriceOverrideQueryOptions`.
- New record schema + paginated/single response envelopes.

**`@voyantjs/i18n`**

- Admin strings for the operator template's "Override pricing" affordance and "Custom price" badge (EN + RO).
