---
"@voyant-travel/relationships": minor
"@voyant-travel/relationships-contracts": minor
"@voyant-travel/framework": minor
"@voyant-travel/framework-migrations": patch
---

Custom-fields unification (phase 2 — person/organization adopt the `custom_fields` column). Both `people` and `organizations` gain a `custom_fields jsonb default '{}'` column (framework bundle migration `0002`), and their create/update routes validate `customFields` at the write boundary against the resolved registry (code ∪ runtime `custom_field_definitions`):

- `relationships`: `RelationshipsRouteRuntime(+Options).customFields` resolver; a `validateRelationshipsCustomFields(c, entity, data)` helper on the accounts route (its `Env` now exposes `container`); person/org writes persist the cleaned value.
- `relationships-contracts`: `customFields` added to the person/organization core schemas.
- `framework`: the relationships factory moves Tier 1 → 2 to receive `capabilities.customFields`.

Values now live on the entity row for `booking`, `person`, and `organization`. Still ahead: repoint the EAV value API to the column + backfill `custom_field_values` → jsonb, then retire the side table. Oracle-verified (bundle + links == live schema).
