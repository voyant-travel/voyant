# ADR: Unify custom fields — one registry, two definition sources, values on the entity

- **Status:** Accepted (implementation in phases)
- **Date:** 2026-06-17
- **Supersedes:** the split between `@voyant-travel/core/custom-fields` (registry + `custom_fields` jsonb column, adopted on `booking`) and the relationships EAV custom-fields system (`custom_field_definitions` + `custom_field_values`).
- **Context:** consolidated-deployments RFC — "custom fields without forking" (the 20%).

## Context — two systems collided

Voyant grew **two** custom-field mechanisms with the same name and overlapping purpose:

1. **Registry + jsonb column** (`@voyant-travel/core/custom-fields`, on `booking`).
   - Definitions **declared in code** (`src/custom-fields/*`, build-time discovery).
   - Values in a **`custom_fields` jsonb column on the entity row**.
   - Typed validation, per-channel **visibility** (export/invoice/search), PII flags.
   - ✅ Reader-visible (export/invoice/search read the row), typed, upgrade-safe.
   - ❌ Adding a field needs a code change + deploy. 5 scalar types only.

2. **EAV side tables** (relationships: `custom_field_definitions` + `custom_field_values`).
   - Definitions **created at runtime** by an admin (CRUD API + UI), keyed by
     `entityType ∈ {organization, person, quote, activity}`.
   - Values in a **`custom_field_values` side table** (one row per field/entity,
     typed value columns).
   - Rich type system: `varchar, text, double, monetary, date, boolean, enum,
     set, json, address, phone, …`; `isRequired`, `isSearchable`, `options`.
   - ✅ Runtime field creation (no deploy), mature type set + admin UI.
   - ❌ Values live in a **side table that export / invoicing / search don't
     see** — the exact failure mode the RFC set out to kill.

Each picked the wrong trade-off on one of **two independent axes**:

| Axis | Registry | EAV | **Unified choice** |
| --- | --- | --- | --- |
| **Value storage** | jsonb on entity ✅ | side table ❌ | **jsonb on entity** |
| **Definition source** | code only ❌ | runtime DB ✅ | **code + runtime DB** |

## Decision

**One custom-field system. Definitions come from both a code registry and the
runtime `custom_field_definitions` table; values live in a `custom_fields` jsonb
column on the entity. `custom_field_values` is retired.**

1. **Single value store — `custom_fields jsonb` on the entity** (`{}` default),
   exactly as `booking` already has. Readers (export/invoice/search) consult the
   registry + read the column — no joins, nothing invisible.
2. **Two definition sources behind one `CustomFieldRegistry`.**
   - Code: `customFieldsFromGlob(import.meta.glob("src/custom-fields/*"))`
     (framework/standard fields, validated, shipped with the deployment).
   - Runtime DB: `custom_field_definitions` rows (operator-created at runtime via
     the existing admin CRUD + UI — kept).
   - `loadCustomFieldRegistry(db)` reads the DB definitions, maps them to
     `CustomFieldDefinition`s, and merges with the code-declared set into one
     registry. Code definitions win on a `(entity, key)` collision (they're the
     contract); a `log` surfaces the shadow.
3. **The registry is resolved per request** — `customFields` injection becomes a
   resolver `(db) => Promise<CustomFieldRegistry>` (cached per isolate with a
   short TTL; definitions change rarely). `booking` moves from its static
   registry to this resolver. Validation/visibility are then identical for code-
   and DB-defined fields.
4. **Canonical type model = the EAV superset.** `core`'s `CustomFieldType` grows
   to cover the runtime types: `text` (`varchar`/`text`), `number` (`double`),
   `monetary` (`{ amountCents, currency }`), `date`, `boolean`, `select`
   (`enum`), `multiselect` (`set`), `json`, with `address`/`phone` validated as
   structured `json` for now (dedicated validators are a follow-up).
   `validateCustomFields` gains the new cases. EAV → registry type map is fixed
   in the loader.
5. **Visibility.** `isSearchable` → `visibility.search`. Add `is_exportable` +
   `is_invoiceable` to `custom_field_definitions` (admin-editable; default
   `export=true`, `invoice=false`) so runtime fields are visibility-aware too.

## Migration

1. Add `custom_fields jsonb default '{}'` to `people`, `organizations`, and the
   other EAV entities (`quotes`, `activities`). (Schema + framework bundle.)
2. **Backfill** — for each `custom_field_values` row, group by
   `(entityType, entityId)`, map each typed value column to its scalar/struct
   form (`text_value`→string, `number_value`→number, `date_value`→ISO,
   `boolean_value`→bool, `monetary_value_cents`+`currency_code`→`{amountCents,
   currency}`, `json_value`→as-is), key by the definition's `key`, and write the
   object into the entity's `custom_fields` column. One data migration, idempotent.
3. **Repoint the value API** — `upsertCustomFieldValue` / `listCustomFieldValues`
   / `deleteCustomFieldValue` read+write the entity's `custom_fields` column
   instead of `custom_field_values`. The admin "set value" UX is unchanged.
4. **Retire `custom_field_values`** once backfill + repoint ship and bake
   (drop the table in a later migration). `custom_field_definitions` stays.

## Phases (each its own PR)

1. **Type model + registry merge (no storage change). ✅ landed.**
   - 1a — `core`'s `CustomFieldType` superset (`multiselect`/`monetary`/`json`) +
     `validateCustomFields` + `mergeCustomFieldDefinitions`.
   - 1b — `loadCustomFieldDefinitions(db)` in relationships (DB→registry mapping);
     `customFields` injection becomes a per-request `CustomFieldRegistryResolver`
     (`(db) ⇒ code ∪ DB`, cached per isolate); `booking` moved onto it. Pure
     addition; nothing migrated yet.
2. **Columns + write/read on person/organization. ✅ landed.** `custom_fields`
   jsonb column on `people`/`organizations` (framework bundle `0002`); the
   accounts route validates person/org writes against the resolved registry
   (`validateRelationshipsCustomFields`); reads return the column. The
   relationships factory moved Tier 1 → 2 to receive `capabilities.customFields`.
3. **Repoint the value API + backfill. ✅ landed.**
   - 3a — `custom_fields` column on `quotes` + `activities` (bundle `0003`).
   - 3b — `upsert/list/deleteCustomFieldValue` read/write the entity column
     (synthetic value-ids `entityType::entityId::definitionId`; bidirectional
     typed↔jsonb mapping; cross-table writes via `sql.identifier`). Round-trip
     integration-tested.
   - 3c — package-owned post-cutline data migration (merge-safe `backfilled ||
     current`), applied automatically during the graph migration plan.
4. **Retire `custom_field_values`** + export/invoice/search consume
   `customFieldsVisibleIn`.
   - 4a — table removed from the schema. The package-owned migration copies and
     validates every legacy row before dropping the table in the same
     transaction; unknown entity types, missing definitions, missing target
     tables, and orphaned entity ids abort without data loss. The older bundle
     guard remains immutable migration history. ✅ landed.
   - 4b — readers consume `customFieldsVisibleIn`.
     - **Export ✅** — the people CSV export appends a column per export-visible
       custom field (`exportPeopleCsv` + `resolveVisibleCustomFields`).
     - **Search ✅** — the people search ORs a `custom_fields ->> key ILIKE term`
       per search-visible field.
     - **Invoice ✅ (seam)** — `InvoiceDocumentRuntimeOptions.resolveCustomFields`
       populates a `customFields` template variable. Finance just exposes the
       hook (decoupled from `relationships`); the deployment wires the resolver
       where it builds the invoice-generation runtime (it holds the registry +
       reads the entity's `custom_fields`) and the template references
       `{{customFields.<key>}}`.

## Consequences

- One mental model, one value store, one validation + visibility path; the
  "side table the readers can't see" bug is gone by construction.
- Runtime field creation is preserved (its only real advantage over the
  registry); standard fields ship in code, operator fields are added live.
- Cost: a data migration + retiring a table + a richer core type model, staged
  so each phase is independently shippable and oracle-verified.

## Alternatives rejected

- **Keep both.** Two value stores per entity, double the write/validate/read
  paths, EAV values stay invisible to readers — ships the bug.
- **Pure EAV (drop the registry).** Loses typed build-time validation,
  visibility, upgrade-safety, and reader-visible values; keeps the side table
  that is the actual problem.
