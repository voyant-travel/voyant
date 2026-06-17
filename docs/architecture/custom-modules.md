# Custom modules — extend a deployment without forking

A deployment can add its own domain modules **on top of** the standard framework
set without editing a single framework-owned file, and the module survives
`voyant upgrade`. This is the "custom module" seam from the consolidated-deployments
RFC (the "20%"). Two mechanisms cooperate, both **build-time** (Cloudflare Workers
compose statically — no runtime `require`):

1. **Runtime mounting** — `src/modules/<name>/index.ts` is auto-discovered and mounted.
2. **Migrations** — `src/modules/<name>/schema.ts` is migrated as a *deployment*
   source, applied by the D.1 collector after the framework bundle.

## TL;DR

```sh
voyant generate module loyalty --dir src/modules   # scaffold
# edit src/modules/loyalty/{schema,routes,service}.ts, add `export default` to index.ts
pnpm db:generate:deployment                         # emit the migration → migrations-d1/
pnpm db:migrate                                     # collector applies it
```

No edits to `composition.ts`, `app.ts`, the framework, or any `*.generated.*` file.

## Folder shape

```
src/modules/loyalty/
  index.ts     # default-exports the module  → auto-mounted
  schema.ts    # Drizzle tables (optional)    → auto-migrated
  routes.ts    # Hono routes
  service.ts   # business logic
  validation.ts
```

The directory name (`loyalty`) is the module's composition key.

## Mounting (`index.ts`)

Default-export the module with `defineDeploymentModule`, which accepts a ready
`HonoModule` **or** a `ModuleFactory` (a `(ctx) => HonoModule` that receives the
deployment's injected capabilities):

```ts
import { defineDeploymentModule } from "@voyant-travel/framework"
import { loyaltyRoutes } from "./routes.js"

export default defineDeploymentModule({
  module: { name: "loyalty" },
  adminRoutes: loyaltyRoutes,        // → /v1/admin/loyalty/*
  // publicRoutes                    → /v1/public/loyalty/*
  // lazyAdminRoutes / lazyPublicRoutes for cold-start weight
})
```

Need an injected provider (db, storage, notifications, …)? Take the factory form:

```ts
export default defineDeploymentModule((ctx) => ({
  module: { name: "loyalty" },
  adminRoutes: createLoyaltyRoutes(ctx.capabilities),
}))
```

### How discovery works

`src/api/composition.ts` (deployment-owned) discovers modules with a Vite glob:

```ts
const discoveredModules = modulesFromGlob<OperatorCapabilities>(
  import.meta.glob("../modules/*/index.ts", { eager: true }),
)
export const deploymentLocalModules = { ...discoveredModules, /* hand-wired */ }
```

Vite compiles `import.meta.glob` to **static imports at build time**, so it
satisfies the Workers build-time-composition constraint — there is no dynamic
module resolution at runtime. The glob is empty until you add a module, so the
seam costs nothing when unused.

## Migrations (`schema.ts`)

Define Drizzle tables normally. They are a **deployment** migration source, not
part of the framework's standard bundle, so:

- **Don't hard-FK across modules.** Reference a framework entity with a plain
  `text("person_id")` column and pair it with `defineLink` in `src/links` — the
  same decoupling the standard modules use. (The deployment source is applied
  *after* the framework bundle, so a hard FK would also work, but plain-text +
  `defineLink` keeps the module relocatable and matches house style.)

```ts
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const loyalty_accounts = pgTable("loyalty_accounts", {
  id: text("id").primaryKey().notNull(),
  person_id: text("person_id").notNull(),
  points: integer("points").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
```

Generate + apply:

```sh
pnpm db:generate:deployment   # drizzle-kit generate against the deployment config
                              # → migrations-d1/NNNN_*.sql (custom tables + link tables)
pnpm db:migrate               # collector: framework bundle → deployment (incl. custom)
```

`db:generate:deployment` uses `drizzle.deployment-migrations.config.ts`, whose
schema glob (`./src/modules/*/schema.ts`) picks up every custom module. The full
`drizzle.config.ts` globs them too, so `db:push`, `db:studio`, and the
migration-replay oracle all see custom tables.

## Why it's upgrade-safe

Everything you write lives under the deployment's `src/` — the framework owns
none of it. `voyant upgrade` bumps `@voyant-travel/framework` (and its pinned
runtime set + migration bundle); your `src/modules/*` and your deployment
migration source (`migrations-d1/`) are untouched. The collector's
content-hash ledger keys migrations by `(source, tag)`, so a framework upgrade
never re-runs or collides with your deployment migrations.

## Limits

- **Standard profile.** A custom module *adds* tables; it doesn't remove or
  re-shape framework tables. Arbitrary add/remove of *framework* modules is the
  D.2 (package-owned migrations) story — out of scope here.
- **Discovery is build-time.** A new module requires a rebuild/redeploy (it's
  compiled in), which is exactly what you want on Workers.

See also: `consolidated-deployments-rfc.md` (the seam catalog) and
`migration-collector-d1.md` (the deployment migration source + collector).
