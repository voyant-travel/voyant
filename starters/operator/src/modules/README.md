# Custom deployment modules

Add a custom module here to extend this deployment **without forking the
framework**. Every `src/modules/<name>/index.ts` is discovered at build time,
added to the graph, and loaded by the generated runtime. The module survives
`voyant upgrade`.

## Shape

```
src/modules/loyalty/
  index.ts     # default-exports the runtime module; activates the convention
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

Schema-bearing reusable modules own their schema and migration history in their
package, exactly like first-party modules. Select that package from
`voyant.config.ts`; do not add an aggregate deployment migration folder.

## Operator-owned units

Keep only deployment-specific product behavior here. Reusable identity and
access behavior, including credential invitations and cloud team management,
is owned by `@voyant-travel/auth`; deployments supply its typed runtime port.
