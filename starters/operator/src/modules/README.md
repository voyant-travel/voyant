# Custom deployment modules

Add a custom module here to extend this deployment **without forking the
framework**. Every `src/modules/<name>/index.ts` is discovered at build time,
added to the graph, and loaded by the generated runtime. The module survives
`voyant upgrade`.

## Shape

```
src/modules/loyalty/
  index.ts     # default-exports the runtime module; activates the convention
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

The resolver creates the graph unit from the project package name and directory
name, then emits a project-relative static import under `.voyant/runtime`.

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

## Operator-owned units

`invitations` and `team` are intentional project-local graph units, not package
bridges. Invitations creates credentials in this deployment's Better Auth and
IAM tables. Team proxies membership for this specific Voyant Cloud deployment
and depends on deployment credentials plus the local cloud-auth identity link.
Those authority boundaries are application policy, so promoting either unit to
a reusable package would be incorrect until a portable identity/membership
contract replaces the deployment semantics.
