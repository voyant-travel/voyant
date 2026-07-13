# Custom fields

Declare deployment-specific fields on core entities (bookings, people,
organizations, products, etc.) without forking. A file here default-exports one
or more `defineCustomField(...)` declarations. Project code collects these
declarations at build time and supplies one registry resolver through
`createVoyantProjectServerEntry({ host: { config: { customFields } } })`.

This directory is a recommended layout, not a runtime scan or an automatic
project convention. See `docs/architecture/custom-fields.md` for the complete
eager-glob, database-definition merge, and selected runtime-port wiring.

```ts
// src/custom-fields/booking.ts
import { defineCustomField } from "@voyant-travel/core/custom-fields"

export default [
  defineCustomField({
    entity: "booking",
    key: "tour_guide",
    type: "text",
    label: "Tour guide",
  }),
  defineCustomField({
    entity: "booking",
    key: "group_size",
    type: "number",
    label: "Group size",
    required: true,
  }),
  defineCustomField({
    entity: "booking",
    key: "meal_plan",
    type: "select",
    label: "Meal plan",
    options: ["none", "half-board", "full-board"],
    visibility: { invoice: true }, // also render on invoices
  }),
]
```

Each field declares:

- `entity` + `key` — what it attaches to (the key is typo-proofed: unknown keys
  are rejected on write).
- `type` — `text` | `number` | `boolean` | `date` | `select` (+ `options`).
- `required`, plus an optional `validate(value)` for custom rules.
- `visibility` — whether it surfaces in `export` (default on), `invoice`, and
  `search` (default off). Readers consult the registry instead of dumping or
  hiding everything.
- `pii` — flag sensitive fields for encryption-at-rest / log redaction.

Values are validated against the registry on write and stored in the entity's
custom-fields JSON. See `docs/architecture/custom-fields.md` for the full design
and how an entity adopts the column.
