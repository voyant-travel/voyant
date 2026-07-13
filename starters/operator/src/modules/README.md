# Custom deployment modules

Add a custom module here to extend this deployment **without forking the
framework**. Every `src/modules/<name>/index.ts` is discovered at build time,
added to the graph, and loaded by the generated runtime. The module survives
`voyant upgrade`.

## Shape

```
src/modules/loyalty/
  index.ts                  # activates the runtime convention
  routes.ts                 # Hono routes
  service.ts                # business logic
  schema.ts                 # optional module-owned Drizzle schema
  drizzle.config.ts         # optional generation config
  migrations/               # optional committed module-owned history
```

`voyant generate module loyalty --dir src/modules` scaffolds this for you.

## index.ts — mounting

Default-export the module via `defineDeploymentModule` (accepts a ready
`HonoModule` or a factory):

```ts
import { defineDeploymentModule } from "@voyant-travel/framework"
import { loyaltyRoutes } from "./routes.js"

export default defineDeploymentModule({
  module: { name: "loyalty" },
  adminRoutes: loyaltyRoutes, // → /v1/admin/loyalty/*
  // publicRoutes / lazyAdminRoutes / lazyPublicRoutes also supported
})
```

The resolver creates the graph unit from the project package name and directory
name, then emits a project-relative static import under `.voyant/runtime`.

## Database migrations

Generate an app-local module's migrations with Drizzle Kit directly; migration
generation is not part of `voyant migrate`:

```bash
pnpm exec drizzle-kit generate \
  --config src/modules/loyalty/drizzle.config.ts \
  --prefix timestamp \
  --name add-loyalty-points
```

The module config points `schema` at `./src/modules/loyalty/schema.ts` and `out`
at `./src/modules/loyalty/migrations`. Declare that same module-scoped folder in
`voyant.config.ts` so it is admitted after selected package migrations:

```ts
export default defineConfig({
  deployment: {
    migrations: [
      { id: "project.module.loyalty", source: "./src/modules/loyalty/migrations" },
    ],
  },
})
```

`voyant migrate` applies the resulting committed SQL; it never generates or
rewrites it. Keep each local module's history in its own directory. A root
aggregate `migrations/` folder is only an explicit escape hatch for genuinely
application-wide DDL.

Schema-bearing reusable modules and plugins own and publish their schema and
migration history inside their package, exactly like first-party modules. A
consumer selects that package and does not regenerate or copy its migrations.

## Operator-owned units

Keep only deployment-specific product behavior here. Reusable identity and
access behavior, including credential invitations and cloud team management,
is owned by `@voyant-travel/auth`; deployments supply its typed runtime port.
