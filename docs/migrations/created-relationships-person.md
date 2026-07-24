# Created Relationships people

The `create_person` MCP Tool now uses the framework's transactional
`handler-command-claim-v1` created-target protocol.

## Caller migration

Every call must supply a non-empty `_voyant.idempotencyKey`. Keep that key
stable across retries of one exact logical command. Reusing it with different
person input is rejected. The optional top-level `idempotencyKey` field is a
compatibility copy only; when supplied, it must equal
`_voyant.idempotencyKey`.

The Tool now always creates a new person. It no longer searches for and returns
a compatible exact-name record, and `allowDuplicateName` has been removed.
Call `list_people` or another read API first when the workflow intends to
resolve an existing person instead of creating one.

The Tool previously returned a mutable person row and `alreadyExists`. It now
returns an immutable created-target envelope:

```ts
const result = await createPerson({
  firstName: "Ana",
  lastName: "Popescu",
  email: "ana@example.com",
  _voyant: { idempotencyKey: commandId },
})

// { status: "created", person: { id: "..." }, replayed: false }
const person = await getPerson({ id: result.person.id })
```

Fresh and replayed responses have the same shape. `replayed` distinguishes a
fresh commit from an exact replay.

The command claim, person row, inline email/phone/website identity contact
points, canonical organization-scoped `person.changed` outbox event, and
immutable result commit in one transaction. Identical command keys in
different principal or organization scopes create distinct people and
distinct lifecycle events.

The package-local HTTP routes, storefront resolution helpers, and domain
service signatures are unchanged.
