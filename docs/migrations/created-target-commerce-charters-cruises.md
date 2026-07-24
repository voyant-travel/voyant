# Created local Commerce, Charters, and Cruises targets

The following MCP Tools now use the framework's transactional
`handler-command-claim-v1` created-target protocol:

- `create_cancellation_policy`
- `create_price_catalog`
- `create_charter_product`
- `create_charter_yacht`
- `create_cruise_ship`

## Caller migration

Every call must supply the same non-empty `idempotencyKey` in the Tool input and
the `_voyant.idempotencyKey` invocation control. Keep that key stable for an
exact logical command. Reusing it with different domain input is rejected.

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

Fresh and replayed responses have the same domain shape; `replayed` reports
which path completed the call. Creation, the opaque command claim, and the
canonical generated-target result commit in one database transaction.

## Direct-consumer audit

The package-local HTTP routes and domain service signatures are unchanged.
Repository search found no direct consumers of these five Tool invocation names
or Tool definition exports outside their owning Commerce, Charters, and Cruises
packages. External MCP clients are the migration audience.

The scoped primitives do not publish through `EventBus`; no post-commit event
gap is hidden by this migration. Commerce promotion creation and cruise/charter
product or booking commands with external or event effects are intentionally
outside this change.
