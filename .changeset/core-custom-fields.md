---
"@voyant-travel/core": minor
---

Add `@voyant-travel/core/custom-fields` — a typed, validated, visibility-aware extension-field registry for core entities (the "custom fields without forking" seam). Dependency-free (no zod/drizzle):

- `defineCustomField` / `createCustomFieldRegistry` — declare fields (`entity`, `key`, `type` of text/number/boolean/date/select, `required`, `options`, `validate`, `visibility`, `pii`).
- `validateCustomFields(registry, entity, input)` — validate a write payload (rejects unknown keys, missing required, wrong type/option, custom rule); returns the cleaned value to persist.
- `customFieldsVisibleIn(registry, entity, channel)` — fields to surface in `export` (default on) / `invoice` / `search` (default off), so those readers consult the registry instead of dumping or hiding everything.
- `customFieldsFromGlob(glob)` — discover deployment-local field declarations from a Vite `import.meta.glob` of `src/custom-fields/*`.

This is the registry primitive; per-entity column adoption (write-validation + export/invoice/search consumption on bookings/people/products) follows. See `docs/architecture/custom-fields.md`.
