# Custom deployment modules

Add a custom module here to extend this deployment **without forking the
framework**. Select `./src/modules/<name>` in `voyant.config.ts`; unselected
directories do not change the graph. The module survives `voyant upgrade`.

## Shape

```
src/modules/loyalty/
  voyant.ts    # import-cheap graph manifest (selected by voyant.config.ts)
  index.ts     # default-exports the runtime module
  schema.ts    # optional: Drizzle tables (migrated automatically)
  routes.ts    # your Hono routes
  service.ts   # your business logic
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

The graph manifest owns API/schema/workflow facets. The runtime factory is bound
to that manifest id in `src/api/composition.ts` until generated local runtime
binding replaces the compatibility map.

## schema.ts — migrations

Define Drizzle tables as usual. They are a **deployment** migration source
(applied by the D.1 collector *after* the framework bundle), so a custom module
table can carry plain text id columns that reference framework tables — pair them
with `defineLink` in `src/links` rather than hard cross-module FKs.

Generate the migration into the deployment source (`migrations/`):

```sh
pnpm db:generate:deployment   # drizzle-kit generate for the deployment config
pnpm db:migrate               # collector applies bundle → deployment (incl. this)
```

See `docs/architecture/custom-modules.md` for the full guide.
