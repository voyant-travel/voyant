# @voyantjs/distribution

## 0.21.1

### Patch Changes

- @voyantjs/availability@0.21.1
- @voyantjs/bookings@0.21.1
- @voyantjs/catalog@0.21.1
- @voyantjs/core@0.21.1
- @voyantjs/db@0.21.1
- @voyantjs/hono@0.21.1
- @voyantjs/identity@0.21.1
- @voyantjs/products@0.21.1
- @voyantjs/suppliers@0.21.1
- @voyantjs/workflows@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/availability@0.21.0
  - @voyantjs/bookings@0.21.0
  - @voyantjs/catalog@0.21.0
  - @voyantjs/core@0.21.0
  - @voyantjs/db@0.21.0
  - @voyantjs/hono@0.21.0
  - @voyantjs/identity@0.21.0
  - @voyantjs/products@0.21.0
  - @voyantjs/suppliers@0.21.0
  - @voyantjs/workflows@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/availability@0.20.0
- @voyantjs/core@0.20.0
- @voyantjs/db@0.20.0
- @voyantjs/hono@0.20.0
- @voyantjs/identity@0.20.0
- @voyantjs/products@0.20.0
- @voyantjs/suppliers@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [714c544]
  - @voyantjs/availability@0.19.0
  - @voyantjs/core@0.19.0
  - @voyantjs/db@0.19.0
  - @voyantjs/hono@0.19.0
  - @voyantjs/identity@0.19.0
  - @voyantjs/products@0.19.0
  - @voyantjs/suppliers@0.19.0

## 0.18.0

### Minor Changes

- 8932f60: Make schema discovery declarative and unblock downstream `drizzle-kit generate` against published packages.

  **Exports — `default` condition added everywhere (fixes #380)**

  Every `@voyantjs/*` package's `publishConfig.exports` previously declared only `types` and `import`. drizzle-kit (and any CJS-based resolver) walked the `require` branch, hit nothing, and threw `ERR_PACKAGE_PATH_NOT_EXPORTED` on subpaths like `@voyantjs/db/schema`. Each subpath now also declares a `default` condition pointing at the same `.js` file, so downstream consumers can resolve subpaths and run their own `drizzle-kit generate` against the canonical runtime schema.

  **Operator template baseline regenerated (fixes #378, #379)**

  `templates/operator/migrations/0000_striped_jubilee.sql` was missing `bookings.fx_rate_set_id` (causing `GET /v1/admin/bookings` to 500), and `@voyantjs/cruises`'s 14 tables had never made it into any baseline. Added `@voyantjs/cruises` to `templates/operator/drizzle.config.ts` and emitted `0004_steady_molten_man.sql` covering all drift (cruise tables/enums, the missing `fx_rate_set_id`, idempotency keys, vouchers, voucher redemptions, the `accessibility_needs` → encrypted-jsonb move, several check constraints, new enum values). Pruned 7 stale orphan migrations that were on disk but not in `_journal.json`. Schema baseline + runtime now match — `drizzle-kit generate` against a freshly migrated DB returns "No schema changes".

  **One `./schema` per module — sub-paths removed (BREAKING)**

  Each module now exposes exactly one schema entrypoint, `./schema`, that re-exports everything DB-related the module owns. Granular sub-paths are deleted from `exports` and `publishConfig.exports`:

  - `@voyantjs/bookings/schema/travel-details` → fold into `@voyantjs/bookings/schema`
  - `@voyantjs/legal/contracts/schema` and `@voyantjs/legal/policies/schema` → fold into the new `@voyantjs/legal/schema`
  - `@voyantjs/{products,crm,cruises,distribution,transactions,charters}/schema` now also re-export the pgTables declared inside `./booking-extension`. The runtime `./booking-extension` HonoExtension export is unchanged.

  Consumers importing from any of the removed sub-paths must switch to the consolidated `./schema` import.

  **Declarative dependency graph in `package.json`**

  Every module package gained a `voyant: { schema, requiresSchemas: [...] }` block declaring its schema entrypoint and the other modules' schemas it needs at the SQL level (e.g. `hospitality` requires `facilities` and `bookings`; `ground` requires `facilities` and `identity`; `suppliers` requires `facilities`; everyone implicitly requires `db`). The CLI reads this block to compute the dependency closure for a project.

  **`@voyantjs/cli` — `resolveSchemas` helper + `voyant db schemas` command**

  New `@voyantjs/cli/drizzle` entrypoint exporting `resolveSchemas(config, options?)` — walks `voyant.requiresSchemas` transitively from the modules listed in `voyant.config.ts`, dedupes, returns specifier strings (default) or absolute file paths (`style: "file"`). Throws on circular dependencies. New `voyant db schemas` debug command prints the resolved closure.

  ```ts
  // drizzle.config.ts
  import { defineConfig } from "drizzle-kit";
  import { resolveSchemas } from "@voyantjs/cli/drizzle";
  import voyantConfig from "./voyant.config";

  export default defineConfig({
    schema: resolveSchemas(voyantConfig),
    out: "./migrations",
    dialect: "postgresql",
    dbCredentials: { url: process.env.DATABASE_URL! },
  });
  ```

  Adding a new module to `voyant.config.ts` now picks up its schema (and transitive schema deps) automatically — no more manual schema lists, no forgotten modules.

  **Migration impact for existing operator deployments**

  Apply `0004_steady_molten_man.sql` (column + new tables, non-destructive aside from the deliberate `accessibility_needs` text → encrypted-jsonb move) and `0005_condemned_nomad.sql` (cruise booking-extension tables — only relevant when the cruises module is mounted).

### Patch Changes

- Updated dependencies [8932f60]
  - @voyantjs/availability@0.18.0
  - @voyantjs/core@0.18.0
  - @voyantjs/db@0.18.0
  - @voyantjs/hono@0.18.0
  - @voyantjs/identity@0.18.0
  - @voyantjs/products@0.18.0
  - @voyantjs/suppliers@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/availability@0.17.0
  - @voyantjs/core@0.17.0
  - @voyantjs/db@0.17.0
  - @voyantjs/hono@0.17.0
  - @voyantjs/identity@0.17.0
  - @voyantjs/products@0.17.0
  - @voyantjs/suppliers@0.17.0

## 0.16.0

### Patch Changes

- Updated dependencies [a4bc773]
  - @voyantjs/availability@0.16.0
  - @voyantjs/core@0.16.0
  - @voyantjs/db@0.16.0
  - @voyantjs/hono@0.16.0
  - @voyantjs/identity@0.16.0
  - @voyantjs/products@0.16.0
  - @voyantjs/suppliers@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/availability@0.15.0
- @voyantjs/core@0.15.0
- @voyantjs/db@0.15.0
- @voyantjs/hono@0.15.0
- @voyantjs/identity@0.15.0
- @voyantjs/products@0.15.0
- @voyantjs/suppliers@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/availability@0.14.0
- @voyantjs/core@0.14.0
- @voyantjs/db@0.14.0
- @voyantjs/hono@0.14.0
- @voyantjs/identity@0.14.0
- @voyantjs/products@0.14.0
- @voyantjs/suppliers@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/availability@0.13.0
- @voyantjs/core@0.13.0
- @voyantjs/db@0.13.0
- @voyantjs/hono@0.13.0
- @voyantjs/identity@0.13.0
- @voyantjs/products@0.13.0
- @voyantjs/suppliers@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/availability@0.12.0
  - @voyantjs/core@0.12.0
  - @voyantjs/db@0.12.0
  - @voyantjs/hono@0.12.0
  - @voyantjs/identity@0.12.0
  - @voyantjs/products@0.12.0
  - @voyantjs/suppliers@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/availability@0.11.0
- @voyantjs/core@0.11.0
- @voyantjs/db@0.11.0
- @voyantjs/hono@0.11.0
- @voyantjs/identity@0.11.0
- @voyantjs/products@0.11.0
- @voyantjs/suppliers@0.11.0

## 0.10.0

### Minor Changes

- 29a581a: Add `connect` value to `channelKindEnum` for partners running Voyant Connect (the inbound API integration surface where operators publish into a third-party network using Voyant infrastructure). Distinguishes from `api_partner`, which remains a generic third-party API integration.

  Synchronised across pgEnum, Zod validation, React schemas / constants / hooks, registry dialogs, en/ro i18n labels, and template copies in `templates/dmc`, `templates/operator`, and `apps/dev`.

### Patch Changes

- Updated dependencies [29a581a]
- Updated dependencies [b7f0501]
  - @voyantjs/availability@0.10.0
  - @voyantjs/core@0.10.0
  - @voyantjs/db@0.10.0
  - @voyantjs/hono@0.10.0
  - @voyantjs/identity@0.10.0
  - @voyantjs/products@0.10.0
  - @voyantjs/suppliers@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/availability@0.9.0
- @voyantjs/core@0.9.0
- @voyantjs/db@0.9.0
- @voyantjs/hono@0.9.0
- @voyantjs/identity@0.9.0
- @voyantjs/products@0.9.0
- @voyantjs/suppliers@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/availability@0.8.0
- @voyantjs/core@0.8.0
- @voyantjs/db@0.8.0
- @voyantjs/hono@0.8.0
- @voyantjs/identity@0.8.0
- @voyantjs/products@0.8.0
- @voyantjs/suppliers@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/availability@0.7.0
- @voyantjs/core@0.7.0
- @voyantjs/db@0.7.0
- @voyantjs/hono@0.7.0
- @voyantjs/identity@0.7.0
- @voyantjs/products@0.7.0
- @voyantjs/suppliers@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/availability@0.6.9
- @voyantjs/core@0.6.9
- @voyantjs/db@0.6.9
- @voyantjs/hono@0.6.9
- @voyantjs/identity@0.6.9
- @voyantjs/products@0.6.9
- @voyantjs/suppliers@0.6.9

## 0.6.8

### Patch Changes

- b218885: Align distribution automation list indexes with the current filter-and-sort query shapes.
- b218885: Align core distribution admin list indexes with their current filter-and-sort query shapes.
- b218885: Align distribution finance list indexes with the current filter-and-sort query shapes.
- b218885: Align distribution inventory list indexes with the current filter-and-sort query shapes.
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/availability@0.6.8
  - @voyantjs/core@0.6.8
  - @voyantjs/db@0.6.8
  - @voyantjs/hono@0.6.8
  - @voyantjs/identity@0.6.8
  - @voyantjs/products@0.6.8
  - @voyantjs/suppliers@0.6.8

## 0.6.7

### Patch Changes

- 7f10cfa: Align distribution channel root indexes with the main list query and add a distribution-owned contact projection so channel reads no longer hydrate directly from identity contact tables.
  - @voyantjs/availability@0.6.7
  - @voyantjs/core@0.6.7
  - @voyantjs/db@0.6.7
  - @voyantjs/hono@0.6.7
  - @voyantjs/identity@0.6.7
  - @voyantjs/products@0.6.7
  - @voyantjs/suppliers@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/availability@0.6.6
- @voyantjs/core@0.6.6
- @voyantjs/db@0.6.6
- @voyantjs/hono@0.6.6
- @voyantjs/identity@0.6.6
- @voyantjs/products@0.6.6
- @voyantjs/suppliers@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/availability@0.6.5
- @voyantjs/core@0.6.5
- @voyantjs/db@0.6.5
- @voyantjs/hono@0.6.5
- @voyantjs/identity@0.6.5
- @voyantjs/products@0.6.5
- @voyantjs/suppliers@0.6.5

## 0.6.4

### Patch Changes

- Updated dependencies [d6c4022]
  - @voyantjs/availability@0.6.4
  - @voyantjs/core@0.6.4
  - @voyantjs/db@0.6.4
  - @voyantjs/hono@0.6.4
  - @voyantjs/identity@0.6.4
  - @voyantjs/products@0.6.4
  - @voyantjs/suppliers@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [d3c6937]
  - @voyantjs/availability@0.6.3
  - @voyantjs/core@0.6.3
  - @voyantjs/db@0.6.3
  - @voyantjs/hono@0.6.3
  - @voyantjs/identity@0.6.3
  - @voyantjs/products@0.6.3
  - @voyantjs/suppliers@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/availability@0.6.2
- @voyantjs/core@0.6.2
- @voyantjs/db@0.6.2
- @voyantjs/hono@0.6.2
- @voyantjs/identity@0.6.2
- @voyantjs/products@0.6.2
- @voyantjs/suppliers@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/availability@0.6.1
- @voyantjs/core@0.6.1
- @voyantjs/db@0.6.1
- @voyantjs/hono@0.6.1
- @voyantjs/identity@0.6.1
- @voyantjs/products@0.6.1
- @voyantjs/suppliers@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/availability@0.6.0
- @voyantjs/core@0.6.0
- @voyantjs/db@0.6.0
- @voyantjs/hono@0.6.0
- @voyantjs/identity@0.6.0
- @voyantjs/products@0.6.0
- @voyantjs/suppliers@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [ce72e29]
- Updated dependencies [ce72e29]
  - @voyantjs/availability@0.5.0
  - @voyantjs/core@0.5.0
  - @voyantjs/db@0.5.0
  - @voyantjs/hono@0.5.0
  - @voyantjs/identity@0.5.0
  - @voyantjs/products@0.5.0
  - @voyantjs/suppliers@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/availability@0.4.5
  - @voyantjs/core@0.4.5
  - @voyantjs/db@0.4.5
  - @voyantjs/hono@0.4.5
  - @voyantjs/identity@0.4.5
  - @voyantjs/products@0.4.5
  - @voyantjs/suppliers@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/availability@0.4.4
- @voyantjs/core@0.4.4
- @voyantjs/db@0.4.4
- @voyantjs/hono@0.4.4
- @voyantjs/identity@0.4.4
- @voyantjs/products@0.4.4
- @voyantjs/suppliers@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/availability@0.4.3
- @voyantjs/core@0.4.3
- @voyantjs/db@0.4.3
- @voyantjs/hono@0.4.3
- @voyantjs/identity@0.4.3
- @voyantjs/products@0.4.3
- @voyantjs/suppliers@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/availability@0.4.2
- @voyantjs/core@0.4.2
- @voyantjs/db@0.4.2
- @voyantjs/hono@0.4.2
- @voyantjs/identity@0.4.2
- @voyantjs/products@0.4.2
- @voyantjs/suppliers@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/availability@0.4.1
- @voyantjs/core@0.4.1
- @voyantjs/db@0.4.1
- @voyantjs/hono@0.4.1
- @voyantjs/identity@0.4.1
- @voyantjs/products@0.4.1
- @voyantjs/suppliers@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/availability@0.4.0
  - @voyantjs/core@0.4.0
  - @voyantjs/db@0.4.0
  - @voyantjs/hono@0.4.0
  - @voyantjs/identity@0.4.0
  - @voyantjs/products@0.4.0
  - @voyantjs/suppliers@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/availability@0.3.1
  - @voyantjs/core@0.3.1
  - @voyantjs/db@0.3.1
  - @voyantjs/hono@0.3.1
  - @voyantjs/identity@0.3.1
  - @voyantjs/products@0.3.1
  - @voyantjs/suppliers@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/availability@0.3.0
- @voyantjs/core@0.3.0
- @voyantjs/db@0.3.0
- @voyantjs/hono@0.3.0
- @voyantjs/identity@0.3.0
- @voyantjs/products@0.3.0
- @voyantjs/suppliers@0.3.0

## 0.2.0

### Patch Changes

- @voyantjs/availability@0.2.0
- @voyantjs/core@0.2.0
- @voyantjs/db@0.2.0
- @voyantjs/hono@0.2.0
- @voyantjs/identity@0.2.0
- @voyantjs/products@0.2.0
- @voyantjs/suppliers@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/availability@0.1.1
- @voyantjs/core@0.1.1
- @voyantjs/db@0.1.1
- @voyantjs/hono@0.1.1
- @voyantjs/identity@0.1.1
- @voyantjs/products@0.1.1
- @voyantjs/suppliers@0.1.1
