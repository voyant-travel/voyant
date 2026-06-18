---
"@voyant-travel/relationships": minor
"@voyant-travel/framework-migrations": patch
---

Custom-fields unification (phase 4a — retire `custom_field_values`). The EAV value side table is removed; values live solely on each entity's `custom_fields` jsonb column.

- The table + its types/relations are dropped from the schema; the person/org merge flow now merges `custom_fields` (keeper wins) instead of value rows.
- A **guarded** retirement migration (framework bundle `0004`) drops the table but **RAISES if it still has rows**, so a deployment that hasn't run the backfill fails the migration loudly instead of losing data. The backfill script gains `--clear` to copy values into the columns and then empty the table.

**Upgrade order:** `tsx scripts/backfill-custom-fields.ts --clear` (copies + empties), then `voyant db migrate` (the guarded drop). Verified: guard refuses with rows, drops when empty; oracle balances.
