# Provider catalog contracts

Status: active rule
Audience: catalog adapter authors, Connect implementers, SDK authors, storefront/admin UI authors

This note defines the provider-facing catalog contracts that sit underneath
the generic source-adapter surface in `@voyantjs/catalog`.

The immediate driver is cruise-source alignment: some providers expose
category-level availability, promotion rows, and sale prices, but do not expose
exact physical cabin identifiers or a reliable row-level relationship between
every price and every offer. The catalog plane must preserve those facts
without making downstream SDKs and UIs guess.

## Capability declarations

Adapters declare method gates such as `supportsLiveResolution` on
`AdapterCapabilities`. Provider feed fidelity is more granular than that, so
adapters also use `providerCapabilities` to state positive, negative, and
unknown facts.

Use these support values:

- `supported` - the provider exposes this capability for the declared scope.
- `unsupported` - the provider explicitly does not expose it. This is a
  meaningful negative declaration, not an omission.
- `unknown` - the adapter cannot tell from the current feed or credentials.

Canonical capability keys:

- `category_availability_counts`
- `physical_inventory_units`
- `inventory_assignment_selection`
- `price_ranges`
- `offer_applicability_evaluation`
- `promotion_media`
- `promotion_stacking_rules`

Example: a cruise provider that exposes category counts but not cabin numbers
should declare `category_availability_counts: supported` and
`physical_inventory_units: unsupported`. UI and SDK code must not infer exact
cabin selection from a positive category-count declaration.

## Promotion applicability

Provider promotion rows are not automatically equivalent to applied checkout
discounts. Adapters normalize provider rows into `ProviderPromotion` when they
need to expose upstream offer metadata.

Applicability uses three levels:

- `evaluable` - the local runtime has enough normalized data to evaluate the
  rule.
- `not_evaluable_locally` - the rule exists but requires provider-side or
  shopper/session context.
- `unknown` - the provider row does not say enough to classify it.

Constraints are typed by kind: loyalty, solo traveler, market, language,
currency, fare code, passenger/occupancy, booking window, travel window, and
customer session. A loyalty or customer-session-dependent offer can be surfaced
as a display card while still being marked non-evaluable locally. Do not attach
blank-fare-code or loyalty offers to all prices unless the provider or shopper
context proves eligibility.

Promotion display fields are normalized separately from applicability:
`display_name`, `subtitle`, `rich_description`, `terms_and_conditions`,
`featured`, `display_priority`, and `media[]` with `hero`, `primary`,
`thumbnail`, `logo`, or `other` media kinds. Keep the raw provider payload for
diagnostics, but UI cards should read the normalized display shape first.

## Availability projections

Availability projections use `AvailabilityProjection`.

The load-bearing fields are:

- `row_kind` - entity, departure, sailing, category, fare, or other.
- `available_units` - a non-negative count or `null` when the provider does
  not expose a count.
- `precision` - exact, category count, lower bound, upper bound, or unknown.
- `status` - available, low, unavailable, sold out, on request, or unknown.
- `low_availability_threshold` - the threshold used to derive `low`, when the
  adapter or vertical policy knows one.
- `badge` - normalized display hint for availability badges.
- `sort_priority` - optional stable numeric ordering hint for search indexes.

`available_units` is only an exact physical-unit count when `precision` is
`exact`. For cruise feeds that expose "3 cabins in category D" but not cabin
numbers, use `precision: "category_count"` and avoid cabin/deck assignment UI
unless a separate capability declaration supports it.

Low-availability badges are derived from the normalized projection, not from
provider-specific constants in UI code. If an adapter cannot justify a
threshold, it should emit `status: "available"` or `status: "unknown"` rather
than inventing urgency.

## Contract ownership

These contracts live in `packages/catalog/src/adapter/contract.ts` with Zod
runtime schemas in `packages/catalog/src/adapter/schemas.ts`. Connect and other
provider integrations should map raw feeds into these shapes before exposing
them to SDK or UI consumers.
