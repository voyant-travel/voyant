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
- `voyant db schemas --emit` generates `drizzle.links.generated.ts` from
  those definitions and includes it from `drizzle.schemas.generated.ts`.
  `voyant db sync-links` remains a transitional escape hatch until each
  template's Drizzle snapshots include the generated link tables.

## Migration schema manifests

Deployment roots that compose modules (`templates/*`, `apps/*`) derive their
Drizzle schema list from `voyant.config.ts`. Do not hand-maintain package schema
paths in `drizzle.config.ts`; import `schema` from
`./drizzle.schemas.generated.ts` and refresh that file with
`voyant db schemas --emit` or `voyant db generate`.

Package-owned tables are declared in that package's `package.json#voyant.schema`
and `requiresSchemas`. Deployment-owned tables that do not belong to a package
go in `voyant.config.ts` as `schemas: ["./src/db/schema.ts"]`; they are appended
after the package-derived schema closure.

Extensions that are mounted at runtime also belong in `voyant.config.ts` under
`extensions`. For schema generation, an extension subpath such as
`@voyantjs/products/booking-extension` seeds the owning package's schema closure
(`@voyantjs/products/schema`). Runtime derivation from `extensions` is a later
phase; for now this is a migration-safety signal.

Link tables are not listed manually in `voyant.config.ts`. They are derived from
the template's `src/links` definitions and emitted to
`drizzle.links.generated.ts`.

## Migration generation and ordering

For composed deployment roots, generate migrations through `voyant db generate`
rather than invoking `drizzle-kit generate` directly. The CLI refreshes
`drizzle.links.generated.ts` and `drizzle.schemas.generated.ts` before Drizzle
diffs the schema, and it defaults `generate` to `--prefix timestamp` unless the
caller supplies an explicit `--prefix`.

Raw `drizzle-kit generate` is only acceptable for package-owned standalone
schema work or when the caller also refreshes the generated manifests and passes
`--prefix timestamp`. `voyant db doctor` continues to report duplicate migration
prefixes. Historical collisions that cannot be safely renamed are recorded in
`migrations/duplicate-prefixes.baseline.json`; new duplicate prefixes must not be
added to that baseline.

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
