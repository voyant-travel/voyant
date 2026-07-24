# Created Commerce, Charters, and Cruises targets

The following MCP Tools now use the framework's transactional
`handler-command-claim-v1` created-target protocol:

- `create_cancellation_policy`
- `create_price_catalog`
- `create_promotion`
- `create_charter_product`
- `create_charter_yacht`
- `create_cruise`
- `create_cruise_ship`

## Caller migration

Every call must supply a non-empty `_voyant.idempotencyKey` invocation control.
Keep that key stable across retries of one exact logical command. Reusing it
with different domain input is rejected. The legacy top-level `idempotencyKey`
field is optional compatibility input; when supplied, it must equal
`_voyant.idempotencyKey`. New callers should treat the `_voyant` value as the
source of truth.

The response no longer contains a mutable database row. Read the generated id
from the typed reference and call the corresponding get Tool when current state
is required:

```ts
const result = await createPriceCatalog({
  code: "PUBLIC",
  name: "Public",
  idempotencyKey: commandId,
  _voyant: { idempotencyKey: commandId },
})

const catalogId = result.priceCatalog.id
```

`create_promotion` previously returned the full mutable promotional-offer row.
It now returns an immutable created-target envelope:

```ts
const result = await createPromotion({
  name: "Summer",
  slug: "summer",
  discountType: "percentage",
  discountPercent: 10,
  scope: { kind: "global" },
  _voyant: { idempotencyKey: commandId },
})

// { status: "created", promotion: { id: "..." }, replayed: false }
const promotion = await getPromotion({ id: result.promotion.id })
```

`create_cruise` previously returned the mutable cruise database row. Read the
new immutable reference envelope instead:

```ts
const result = await createCruise({
  slug: "danube-highlights",
  name: "Danube Highlights",
  cruiseType: "river",
  nights: 7,
  _voyant: { idempotencyKey: commandId },
})

const cruiseId = result.cruise.id
// result.status === "created"
// result.replayed distinguishes a fresh commit from an exact replay.
```

Fields such as `name`, `status`, and timestamps are no longer present in the
`create_cruise` response. Use `get_cruise` when current mutable state is
required.

Fresh and replayed responses have the same domain shape; `replayed` reports
which path completed the call. Creation, the opaque command claim, and the
canonical generated-target result commit in one database transaction.

## Direct-consumer audit

The package-local HTTP routes and domain service signatures are unchanged.
Repository search found no direct consumers of these six Tool invocation names
or Tool definition exports outside their owning Commerce, Charters, and Cruises
packages. External MCP clients are the migration audience.

The five pre-existing local primitives do not publish through `EventBus`.
Promotion creation atomically appends its deterministic `promotion.changed`
event to the database outbox alongside the offer, materialized product links,
command claim, and canonical result.
`create_cruise` transactionally captures its canonical-cruise-scoped
`cruise.created` outbox event with the cruise, required search projection,
command ledger, and immutable result. Distinct principals therefore retain
distinct lifecycle events even when their caller-selected command keys and
payloads match. Cruise and charter booking commands with external effects
remain intentionally outside this migration.
