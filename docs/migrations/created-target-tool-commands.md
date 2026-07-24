# Created-target Tool command migration

The Distribution and Legal create Tools now use durable created-target commands:

- `create_supplier`
- `create_distribution_channel`
- `create_legal_contract_draft`

## Caller changes

Every invocation must include a stable, caller-selected `idempotencyKey`. Reuse
the same key only when retrying the exact same command. The key is scoped by the
canonical principal type, principal id, and organization, so different
authentication realms and organizations remain independent.

```ts
const result = await callTool("create_supplier", {
  idempotencyKey: "supplier-import:acme:2026-07-24",
  name: "Acme Experiences",
})
```

Create responses are now immutable references rather than mutable entity
snapshots:

```ts
{
  status: "created",
  supplier: { id: "supp_..." },
  replayed: false,
}
```

The channel response uses `channel`, and the contract-draft response uses
`contract`. Read the full current record with the corresponding `get_*` Tool
after creation. Exact retries return the same id with `replayed: true`.
Reusing the key with changed command input is rejected before domain mutation.

No database schema migration is required; the durable claim and canonical
result are stored in the existing action-ledger schema.
