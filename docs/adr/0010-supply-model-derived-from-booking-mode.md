# ADR-0010: Keep `supplyModel` derived from `bookingMode`

- **Status:** Accepted (2026-07-01)
- **Relates to:** [#2644](https://github.com/voyant-travel/voyant/issues/2644),
  [#2329](https://github.com/voyant-travel/voyant/issues/2329) (supply-model
  enforcement), [catalog supply models](../architecture/catalog-supply-models.md),
  [catalog architecture](../architecture/catalog-architecture.md)
- **Implemented by:** This ADR records an existing decision. No code change
  beyond a comment pointer at the derivation site; the promotion described under
  "Revisit trigger" is deferred.

## Context

Every product carries a `supplyModel` classifier — `dynamic` (live-composed, any
date, calendar pricing) or `scheduled` (fixed dated departures with seat
allotment). It is a durable, product-agnostic split that drives the search and
booking surface, distinct from `category` (package/tour/excursion…) which lives
on productType/categories. See
[`catalog-supply-models.md`](../architecture/catalog-supply-models.md).

Today `supplyModel` is **not a stored column**. It is derived from the product's
`bookingMode` at projection time by `deriveProductSupplyModel(bookingMode)` in
`packages/inventory/src/service-catalog-plane.ts`:

- `open` / `stay` → `dynamic`
- `date` / `date_time` / `transfer` / `itinerary` / `other` → `scheduled`

The derivation is one source of truth for a classifier that two enforcement
paths now depend on (both landed with the #2329 supply-model enforcement work):

- **scheduled** products must have at least one future open departure before
  publish — enforced in `packages/inventory/src/service-core.ts`
  (`no_future_open_departure`).
- **dynamic** products must not author static availability — enforced in
  `packages/operations/src/availability/service-core.ts`
  (`assertProductAllowsStaticAvailability` → `dynamic_product_static_availability`).

Now that the classifier drives real publish-time and authoring-time rules, the
question is whether it should stay derived or become a first-class, explicitly
authored field. This ADR records that decision rather than leaving it implicit
in a code comment.

## Decision

**Keep `supplyModel` derived from `bookingMode`.** Do not add a schema column,
migration, authoring field, or consistency validation at this time.

The single derivation function `deriveProductSupplyModel` remains the one place
the classifier is computed, and the catalog field policy continues to project it
as a `source-only`, `structural`, `indexed-column` field
(`packages/inventory/src/catalog-policy.ts`).

## Options considered

### Option A — Derived from `bookingMode` (chosen, status quo)

`supplyModel` is computed from `bookingMode` wherever it is needed.

- **Pros:** Zero schema surface. One source of truth — the classifier can never
  drift out of sync with the booking mechanic, so there is nothing to backfill,
  validate, or reconcile. The enforcement paths added by #2329 stay trivially
  consistent.
- **Cons:** The supply model is permanently coupled to `bookingMode`. A product
  cannot express a supply model the derivation can't produce — for example an
  `itinerary` product sold dynamically, or an `open`/`stay` product sold on a
  scheduled basis. The structural classifier and the booking mechanic are welded
  together.

### Option B — First-class column + authoring field

`supplyModel` becomes a stored column on the products table, set explicitly by
authoring/agents, with the derivation used only as a default/suggestion.

- **Pros:** Decouples the booking mechanic (`bookingMode`) from the structural
  supply classifier (`supplyModel`). Authoring and agents can set it explicitly,
  unlocking combinations the derivation can't express.
- **Cons:** A new column and migration; a consistency validation to keep an
  explicit `supplyModel` sensible against `bookingMode`; and a backfill for
  existing rows. More schema surface and more that can drift.

## Rationale

No current vertical needs a supply model that the `bookingMode` derivation can't
express. Every shipped product's supply model is fully implied by its booking
mechanic, so the decoupling Option B buys is unused capability today. Option A
keeps the classifier as a single derived source of truth — the cheapest shape
that satisfies the #2329 enforcement paths — and avoids introducing a column,
migration, backfill, and drift-consistency check that would exist only to be
kept equal to the derivation.

Deferring the promotion is low-cost and reversible: because the classifier is
computed in one function, promoting it later is a contained change, not a
scattered refactor.

## Revisit trigger

Promote `supplyModel` to a first-class column + authoring field **when — and
only when — a vertical needs a supply model that the `bookingMode` derivation
can't express** (e.g. an `itinerary` product that must sell dynamically, or an
`open`/`stay` product that must sell on scheduled departures).

When that trigger fires, the touch points to change are:

- `packages/inventory/src/schema-core.ts` — add the `supplyModel` column to the
  products table (with a migration + backfill from the derivation).
- `packages/inventory/src/authoring/spec.ts` — add `supplyModel` to
  `productRowSpecSchema` so authoring/agents can set it explicitly.
- `packages/inventory/src/authoring/validate.ts` — add a consistency check that
  an explicitly authored `supplyModel` is sensible against `bookingMode`.
- `packages/inventory/src/service-catalog-plane.ts` — change
  `deriveProductSupplyModel` from the source of truth to a default/suggestion
  (read the stored column when present, fall back to the derivation otherwise).

## Consequences

- The catalog policy, search index, and the two enforcement paths continue to
  treat `supplyModel` as a real structural classifier, unaware that it is
  derived rather than stored — so a future promotion does not change their
  contract.
- The derivation site in `service-catalog-plane.ts` carries a pointer to this
  ADR so the coupling is a recorded, intentional decision rather than an
  unexplained inline note.
- Authoring cannot set `supplyModel` independently of `bookingMode` until the
  promotion happens. This is acceptable while no vertical needs the split.
