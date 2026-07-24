# Created Relationships organizations

The `create_organization` MCP Tool now uses the framework's transactional
`handler-command-claim-v1` created-target protocol.

## Caller migration

Every call must supply a non-empty `_voyant.idempotencyKey`. Keep that key
stable across retries of one exact logical command. Reusing it with different
organization or billing-address input is rejected. The legacy top-level
`idempotencyKey` field remains optional compatibility input; when supplied, it
must equal `_voyant.idempotencyKey`.

The Tool previously returned mutable organization and billing-address rows. It
now returns an immutable created-target envelope:

```ts
const result = await createOrganization({
  name: "Example Travel",
  vatNumber: "RO123",
  billingAddress: {
    label: "billing",
    line1: "Calea Victoriei 1",
    country: "RO",
  },
  _voyant: { idempotencyKey: commandId },
})

// { status: "created", organization: { id: "..." }, replayed: false }
const organization = await getOrganization({ id: result.organization.id })
```

Fresh and replayed responses have the same shape. `replayed` distinguishes a
fresh commit from an exact replay.

The command claim, organization, optional billing address, canonical
organization-scoped `organization.changed` outbox event, and immutable result
commit in one transaction. Identical command keys in different principal or
organization scopes create distinct organizations and distinct lifecycle
events.

The package-local HTTP routes and domain-service signatures are unchanged.
