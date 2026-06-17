---
"@voyant-travel/core": minor
"@voyant-travel/relationships": minor
"@voyant-travel/bookings": minor
---

Custom-fields unification (phase 1b — DB-backed definitions + per-request resolver). The custom-field registry is now resolved per request from two sources, so runtime-defined fields participate alongside code-declared ones (ADR: `docs/architecture/custom-fields-unification-adr.md`):

- `core`: new `CustomFieldRegistryResolver = (db) => CustomFieldRegistry | Promise<…>` type.
- `relationships`: `loadCustomFieldDefinitions(db)` reads the runtime `custom_field_definitions` table and maps it to registry definitions (`varchar`→`text`, `double`→`number`, `enum`→`select`, `set`→`multiselect`, `address`/`phone`→`json`; `isSearchable`→`visibility.search`).
- `bookings`: the `customFields` route-runtime option is now a resolver; the write-validation helper resolves the registry from the request `db` (so it sees both code- and DB-defined fields). The operator wires a resolver that merges its code-declared fields with `loadCustomFieldDefinitions(db)` (code wins), cached per isolate.

No storage change yet — values still go to the entity `custom_fields` jsonb (booking) / the EAV table (person/org). Subsequent phases add the person/org column, repoint the value API, and backfill `custom_field_values` → jsonb.
