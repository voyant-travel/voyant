# Schema discipline

This document captures the rules that keep Voyant's per-module schemas
shippable as independent packages.

## The FK rule

> **Intra-domain FKs are fine. Cross-domain FKs MUST go through a link table.**

Concretely:

- A reference between two tables defined in **the same package** uses
  Drizzle's `.references(() => other.id, { onDelete: ... })` and creates a
  real Postgres FK constraint.
- A reference between two tables defined in **different packages** uses a
  plain `text("foo_id")` column plus a `defineLink(...)` declaration at the
  template level.

### Why

Each module is a separately publishable package. Cross-package
`.references()` calls force schema co-installation: a consumer who
installs `@voyantjs/ground` but not `@voyantjs/facilities` cannot create
the `facility_id` foreign-key constraint that `ground.transport_pickups`
declares. That breaks the module-as-a-package boundary.

Links keep the wiring explicit at the template (deployment) layer:
- The source package exports a `LinkableDefinition` (e.g.
  `personLinkable`, `productLinkable`).
- The template declares `defineLink(personLinkable, productLinkable)` in
  `templates/<name>/src/links/`.
- `voyant db sync-links` materialises a pivot table whose lifecycle is
  owned by the template, not either feature module.

### When you're adding a column

1. Is the target table defined in the same package?
   - **Yes.** Use `.references()`. Done.
2. Is the column for an association the *template* manages, not the
   module itself?
   - **Yes.** Add `text("foo_id")` (indexed if appropriate), export a
     `*Linkable` from each side, and call `defineLink(...)` in the
     consuming template's `src/links/`.
3. Is the column for a *required vertical extension* (e.g.
   `booking_product_details.booking_id` → `bookings.id`)?
   - In rare cases, this is allowed even cross-package because the
     extension package depends on the parent (one-way) and is never used
     without it. Document the exception in code with a comment.

## Known violations (as of 2026-04-25)

The audit below was produced by grepping `\.references\(.*=>.*\.id` across
every `packages/*/src/schema*.ts` and `packages/*/src/schema/*.ts` file,
then filtering to imports that cross package boundaries (excluding shared
helpers like `@voyantjs/db/lib/typeid-column` and type-only imports of
`KmsEnvelope`).

Type-only imports (`import type { ... }`) and `relations(...)`-only
references are excluded — they don't create FK constraints.

| Source package | Target package (table) | File(s) | Count |
|---|---|---|---|
| `ground` | `facilities` (`facilities`) | `schema-dispatch.ts`, `schema-operations.ts`, `schema-operators.ts` | 7 |
| `ground` | `identity` (`identity_addresses`) | `schema-dispatch.ts`, `schema-operations.ts` | 6 |
| `accommodations` | `facilities` (`properties`) | `schema-bookings.ts`, `schema-inventory.ts` | 4 |
| `accommodations` | `bookings` (`booking_items`) | `schema-bookings.ts` | 1 |
| `suppliers` | `facilities` (`facilities`) | `schema.ts` | 2 |

Each of these is a follow-up issue: convert the `.references()` call to a
plain `text()` column + `defineLink()` at the template level. File issues
per-package so the work parallelises.

## Soft-delete discipline

Tables that declare `deletedAt` are filtered automatically by
`createCrudService(...)`'s `list` / `count` / `listAndCount` / `retrieve`
methods. The default is "active rows only"; pass `includeDeleted: true`
to opt back in (admin recycle bins, audit reports, reconciliation jobs).

For ad-hoc queries that don't go through `createCrudService`, compose
`whereActive(table)` from `@voyantjs/db/lifecycle` into the WHERE clause:

```ts
import { and, eq } from "drizzle-orm"
import { whereActive } from "@voyantjs/db/lifecycle"

await db
  .select()
  .from(bookings)
  .where(and(eq(bookings.organizationId, orgId), whereActive(bookings)))
```

`whereActive(table)` returns `undefined` for tables without `deletedAt`,
so `and(other, undefined)` collapses cleanly — the helper is safe to
apply unconditionally.

`hasSoftDelete(table)` is exported alongside for code paths that need to
branch on whether soft-delete applies (e.g. when generating dynamic
clauses).

## Migration generation & ordering

A template's Drizzle schema set is **derived from `voyant.config.ts`**, not
hand-listed. The manifest's `modules` + `extensions` + `additionalSchemas`
(package closures) plus `schemas` (template-local files) are resolved into a
committed `drizzle.schemas.generated.ts` that `drizzle.config.ts` imports. See
[`migration-resilience-rfc.md`](./migration-resilience-rfc.md) (voyant#1608).

Rules:

- **Never hand-edit the schema list** in `drizzle.config.ts`. Add the
  module/extension/package to `voyant.config.ts` and run `voyant db generate`
  (or `voyant db schemas --emit`) to refresh the generated manifest.
- **New migrations use timestamp prefixes.** `voyant db generate` defaults to
  `--prefix timestamp`, so concurrently-authored migrations never collide on a
  sequential index. The pre-existing sequential migrations stay as-is.
- **Pre-existing duplicate prefixes are baselined**, not rewritten, in
  `migrations/duplicate-prefixes.baseline.json`. `voyant db doctor` fails only
  on *new* (un-baselined) collisions.
- **Cross-module link tables are folded into the migration history.** Generate
  their Drizzle definitions with `voyant db sync-links --emit-drizzle` (writes
  `drizzle.links.generated.ts`, referenced from the manifest's `schemas`), then
  `voyant db generate` so Drizzle owns their diff/snapshot — instead of applying
  them out-of-band via raw `sync-links` DDL.
- **`voyant db doctor --fail-on-drift` gates CI** — it cross-checks manifest
  resolvability, schema parity, generated-manifest freshness, duplicate prefixes
  (vs the baseline), and that every link table is in the latest snapshot.

Generated files (`*.generated.ts`) are excluded from formatting so
`voyant db generate` is a no-op when nothing changed.
