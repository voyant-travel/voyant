---
"@voyant-travel/relationships": minor
---

Custom-fields unification (phase 3b/3c — repoint the value API to the entity column + backfill). The runtime custom-field value API now reads/writes the entity's `custom_fields` jsonb column instead of the `custom_field_values` side table, so admin-set custom fields are visible to export/invoice/search like every other field:

- `upsertCustomFieldValue` / `listCustomFieldValues` / `deleteCustomFieldValue` operate on the column. The admin API contract is preserved via **synthetic value-ids** (`entityType::entityId::definitionId`) and a faithful, round-trip-tested mapping between the EAV typed columns and the single jsonb value (`enum`→string, `monetary`→`{amountCents,currency}`, `set`→array, …). `phone` now maps to `text` (a string) for consistency with the entity-update path.
- A one-time idempotent backfill (`starters/operator/scripts/backfill-custom-fields.ts`, merge-safe `backfilled || current`) moves existing `custom_field_values` rows into the columns. **Run it once during the upgrade** (after `db migrate` + deploying this), else historical custom fields stay invisible until then.

Validated with unit round-trips + a live integration round-trip (upsert→list→delete) and a live backfill. `custom_field_values` is retired next (phase 4) once baked.
