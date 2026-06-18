---
"@voyant-travel/core": minor
---

Custom-fields unification (phase 1a — type model + merge). Grow `@voyant-travel/core/custom-fields` toward one system that absorbs the relationships EAV custom-fields feature (see `docs/architecture/custom-fields-unification-adr.md`):

- `CustomFieldType` becomes the canonical superset — adds `multiselect` (a subset of `options`, stored `string[]`), `monetary` (`{ amountCents, currency }`, new `CustomFieldMonetaryValue` type), and `json` (arbitrary, also the home for `address`/`phone`). `validateCustomFields` validates each. Purely additive — existing `text`/`number`/`boolean`/`date`/`select` fields are unchanged.
- `mergeCustomFieldDefinitions(sources, onShadow?)` — dedupes `(entity, key)` across sources, earlier source winning (code-declared before runtime/DB-defined), with a shadow callback. Feed its result to `createCustomFieldRegistry` to build one registry from both a code source and the runtime `custom_field_definitions` table.

Storage migration (values → entity `custom_fields` jsonb, retiring `custom_field_values`) and the DB-backed registry loader land in the following phases.
