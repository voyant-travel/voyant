# Custom fields — typed extension fields on core entities

The single most common client ask is "add a few fields to bookings / people /
products." This is the seam that lets a deployment do that **without forking**,
and have those fields be validated, and visible to exports / invoices / search.

## Why not just `metadata`?

Most core entities already carry a free-form `metadata` jsonb column — the
unstructured escape hatch (this is also Medusa's model: a `metadata` field plus
an `additional_data` payload validated by an ad-hoc zod schema at each API
route). Free-form metadata is fine for opaque key/values, but it is **invisible
to the rest of the system**: an export doesn't know which keys to include, an
invoice can't decide what to render, search can't index it, and nothing
validates a typo'd key.

Voyant adds a thin **registry** on top so a *declared* subset of that space
becomes real fields — the adaptation of Medusa's boundary-validation idea into
something typed and visibility-aware.

## The registry (`@voyant-travel/core/custom-fields`)

Dependency-free (no zod/drizzle), so it lives in `core` and is importable
anywhere:

```ts
import {
  defineCustomField,
  createCustomFieldRegistry,
  validateCustomFields,
  customFieldsVisibleIn,
} from "@voyant-travel/core/custom-fields"

const registry = createCustomFieldRegistry([
  defineCustomField({ entity: "booking", key: "group_size", type: "number", label: "Group size", required: true }),
  defineCustomField({ entity: "booking", key: "meal_plan", type: "select", label: "Meal plan", options: ["none", "half-board", "full-board"], visibility: { invoice: true } }),
])

// on write:
const result = validateCustomFields(registry, "booking", input.custom_fields)
if (!result.ok) throw badRequest(result.errors)   // unknown key / missing required / wrong type / bad option / custom rule
persist({ custom_fields: result.value })

// on export / invoice / search:
const exported = customFieldsVisibleIn(registry, "booking", "export")  // fields with visibility.export (default true)
```

A field declares `entity`, `key` (typo-proofed — unknown keys are rejected),
`type` (`text|number|boolean|date|select` + `options`), `required`, an optional
`validate(value)` rule, `visibility` (`export` default on; `invoice`/`search`
default off), and `pii` (encrypt-at-rest / redact).

## Declaring fields in a deployment (discovery)

The registry is **deployment config**. A deployment drops field files into
`src/custom-fields/*.ts` and they're auto-discovered (same `import.meta.glob`
mechanism as `src/modules` / `src/extensions` / `src/admin`):

```ts
// src/lib/custom-fields.ts  (already wired in the operator starter)
export const operatorCustomFields = createCustomFieldRegistry(
  customFieldsFromGlob(import.meta.glob("../custom-fields/*.ts", { eager: true })),
)
```

```ts
// src/custom-fields/booking.ts
import { defineCustomField } from "@voyant-travel/core/custom-fields"
export default defineCustomField({ entity: "booking", key: "tour_guide", type: "text", label: "Tour guide" })
```

## How an entity adopts custom fields

The registry is injected into the services that own the entity (the standard
Voyant provider-injection pattern — the deployment passes `operatorCustomFields`
into the module's options; the leaf package never imports the deployment). The
owning entity:

1. **Storage** — a `custom_fields jsonb default '{}'` column (or a namespaced
   slice of the existing `metadata`). The value is whatever
   `validateCustomFields(...).value` returns.
2. **Write path** — `create`/`update` run `validateCustomFields(registry,
   entity, input.custom_fields)` and persist `result.value`, rejecting on
   `!result.ok`.
3. **Read paths** — export / invoice / search consult
   `customFieldsVisibleIn(registry, entity, channel)` to decide inclusion.

Entity adoption is incremental (one entity at a time) and additive — the
registry primitive + discovery shipped first; wiring the `custom_fields` column
and validation into `booking` / `person` / `product` services follows per
entity.

## Status

- ✅ Registry primitive (`@voyant-travel/core/custom-fields`) + validation +
  visibility + `customFieldsFromGlob` discovery.
- ✅ Deployment discovery wired in the operator (`src/custom-fields/` →
  `operatorCustomFields`).
- ✅ **`booking` adopted** — `custom_fields` column + write-validation at the
  create/update routes (registry injected via `FrameworkProviders.customFields`),
  oracle-verified.
- ⏳ `person` / `product` adoption + export/invoice/search consumption of
  `customFieldsVisibleIn`.

### Worked example — how `booking` adopted it

1. **Column** — `custom_fields jsonb default '{}'` on `bookings`
   (`packages/bookings/src/schema-core.ts`); the framework bundle picked it up as
   migration `0001` on regeneration.
2. **Injection** — `BookingRouteRuntimeOptions.customFields?: CustomFieldRegistry`
   → `createBookingsHonoModule` → an optional `FrameworkProviders.customFields`
   the deployment supplies (operator: `customFields: operatorCustomFields`).
3. **Write validation** — `validateBookingCustomFields(c, data)` runs in the
   POST/PATCH handlers: `validateCustomFields(registry, "booking", data.customFields)`,
   replacing the payload with the cleaned value or throwing a 400.
4. **Read** — `custom_fields` rides along on the booking row.

See also `custom-modules.md` (the sibling discovery seams) and the
consolidated-deployments RFC seam catalog.
