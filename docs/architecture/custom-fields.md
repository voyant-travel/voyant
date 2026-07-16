# Custom Fields

The ownership and namespace model follows
[`remote-app-platform-rfc.md`](./remote-app-platform-rfc.md). Database
definitions are the sole runtime authority and entity values use the
namespaced JSONB shape described below.

Custom fields add typed, visibility-aware fields to core entities without
forking their owning packages. They are appropriate when a value must be
validated or intentionally exposed to exports, invoices, or search.

## Why Not Metadata?

Free-form `metadata` remains the escape hatch for opaque application data. It
cannot provide system-wide guarantees: readers do not know which keys are
valid, which values are sensitive, or which channels may expose them.

A custom-field declaration supplies that contract:

- `entity` and stable `key`
- `type`, `required`, and declarative options
- channel visibility for export, invoice, and search
- a `pii` marker for storage and redaction policy

Values remain stored with the owning entity in a `custom_fields` JSONB column:

```ts
customFields[definition.namespace][definition.key] = value
```

Custom fields do not introduce a cross-domain value table.

## Registry Primitive

`@voyant-travel/core/custom-fields` is dependency-free and owns registry,
validation, and visibility helpers:

```ts
import {
  createCustomFieldRegistry,
  customFieldsVisibleIn,
  validateCustomFields,
} from "@voyant-travel/core/custom-fields"

const registry = createCustomFieldRegistry([
  {
    entity: "booking",
    namespace: "custom",
    key: "group_size",
    type: "number",
    label: "Group size",
    required: true,
  },
])

const result = validateCustomFields(registry, "booking", input.customFields)
if (!result.ok) throw badRequest(result.errors)

const exported = customFieldsVisibleIn(registry, "booking", "export")
```

Unknown keys, missing required fields, invalid types, and unsupported options
are rejected before persistence. Definitions contain persisted declarative
constraints only; executable validation callbacks are unsupported.

## Runtime Ownership

Custom-field injection follows the selected deployment graph. It does not use
`FrameworkProviders.customFields` and the generic Operator host does not import
Bookings or Relationships to wire their route options.

The authority chain is:

1. Selected package manifests declare their runtime and required typed ports.
2. Generated graph composition loads only the selected package runtime
   contributors.
3. `@voyant-travel/custom-fields` loads `custom_field_definitions` through
   `loadCustomFieldRegistry(db)` on each request. Entity writes use
   `loadCustomFieldRegistryForWrite(db, entity)` inside their write transaction,
   taking shared definition locks before validation.
4. The generic package exposes that database-backed resolver through the typed
   custom-fields runtime port.
5. Bookings, Relationships, search, export, and invoice consumers use the same
   persisted definition shape.

Operator-owned definitions are created and edited in Settings. Project-local
TypeScript declarations, discovery globs, host injection, and code/database
merge precedence are unsupported. App-owned definitions use the authenticated,
owner-constrained app API. Neither path can shadow a persisted
`(entity, namespace, key)` definition.

Definition identity is `(entity, namespace, key)`. Operator fields use the
server-assigned `custom` namespace; app/platform callers receive owner and
physical namespace only from trusted runtime context. Settings can inspect
active definitions from every owner, but ordinary CRUD structurally controls
only operator-owned rows. Every active definition enters the runtime registry,
and values are read and written by full `(entity, namespace, key)` identity.
Ordinary operator entity routes accept only the server-reserved `custom`
namespace and preserve all other namespaces; trusted app/platform value
operations derive their namespace from owner context.

## Entity Adoption

An owning package adopts custom fields by implementing all of these boundaries:

1. **Storage:** persist validated values under
   `custom_fields[namespace][key]` in the owning entity row.
2. **Write validation:** inside the entity transaction, lock the entity's
   definitions, run `validateCustomFields`, and then persist. Definition
   rename/delete takes conflicting locks in the same definition-first order.
3. **Read policy:** call `customFieldsVisibleIn` before including fields in
   exports, invoices, or search indexes.
4. **Runtime declaration:** request the narrow typed port in the package
   manifest and contribute package-owned value operations for the entity tables
   it owns.

The generic custom-fields API dispatches value operations through those
selected-graph contributions. It contains no cross-package entity table map,
and unsupported targets fail closed. Additional entities adopt the same
contract incrementally; a generic host-level provider or package-specific
starter branch must not be reintroduced.

## Invariants

- Packages never import project code.
- Persisted definitions are the sole runtime authority.
- Runtime packages request custom fields through declared ports only.
- Project code cannot inject, merge, or shadow effective definitions.
- Target capabilities are authoritative: unsupported search, export, and
  invoice flags are stored as `false`.
- Unknown fields fail closed on writes.
- Generic value writes validate their typed payload against the locked
  persisted definition, including required/options/type constraints.
- Ordinary operator writes cannot overwrite or delete app/platform namespaces.
- Entity validation and persistence share a transaction-scoped definition lock,
  so rename/delete cannot race a write using an obsolete key.
- Definition key rename and delete delegate to the package that owns the entity
  table, require exactly one owning provider, and mutate only the matching
  namespace.
- Visibility defaults remain conservative: export on, invoice and search off.
- Adding or updating an operator field requires no rebuild or restart.
