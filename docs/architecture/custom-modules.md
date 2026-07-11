# Custom modules — extend a deployment without forking

A deployment can add its own domain modules **on top of** the standard framework
set without editing a single framework-owned file, and the module survives
`voyant upgrade`. This is the "custom module" seam from the consolidated-deployments
RFC (the "20%"). Three mechanisms cooperate, all **build-time**, so the resolved
graph lowers to one deterministic Node application artifact with no runtime
package discovery:

1. **Graph activation** — `src/modules/<name>/index.ts` is discovered at build time.
2. **Declaration and runtime** — the resolver synthesizes the project-owned graph
   unit and `index.ts` exports its runtime factory.
3. **Migrations** — `src/modules/<name>/schema.ts` is migrated as a *deployment*
   source, applied by the D.1 collector after the framework bundle.

## TL;DR

```sh
voyant generate module loyalty --dir src/modules   # scaffold
# edit src/modules/loyalty/{index,schema,routes,service}.ts
pnpm db:generate:deployment                         # emit the migration → migrations/
pnpm db:migrate                                     # collector applies it
```

No edits to `app.ts`, the framework, or any generated file.

## Project workflows and jobs

Application-level workflows and low-level jobs can live directly under
`src/workflows` and `src/jobs`. The framework compiler scans these directories
at build time, validates their export contracts without importing them, and
emits sorted static registries. It never scans directories or registers
definitions by side effect at runtime.

A project workflow must directly default-export the pure `defineWorkflow`
definition imported from `@voyant-travel/workflows`. Named type exports are
allowed; named runtime exports and the registering `workflow(...)` helper are
not convention inputs.

```ts
// src/workflows/booking/send-reminder.ts
import { defineWorkflow } from "@voyant-travel/workflows"

export interface SendReminderInput {
  bookingId: string
}

export default defineWorkflow<SendReminderInput, void>({
  id: "booking.send-reminder",
  run: async (input, ctx) => {
    await ctx.step("send", async () => {
      // Send the reminder through an injected service.
    })
  },
})
```

A project job must export a named `schedule` value and default-export its
handler. Jobs are the explicit low-level maintenance escape hatch; public
scheduled product work should use a workflow's `schedule` declaration.

```ts
// src/jobs/reconcile-search.ts
export const schedule = { cron: "0 3 * * *" }

export default async function reconcileSearch(): Promise<void> {
  // Run deployment-local maintenance work.
}
```

The compiler writes `.voyant/runtime/project-workflows.generated.ts` and
`.voyant/runtime/project-jobs.generated.ts`. These disposable TypeScript files
contain only deterministic static imports plus path-derived convention IDs.
Source imports that escape the project root, normalized ID collisions, missing
exports, indirect or registering workflow definitions, and extra runtime
exports fail compilation with stable diagnostics.

## Folder shape

```
src/modules/loyalty/
  index.ts     # default-exports the runtime module and activates the convention
  schema.ts    # Drizzle tables (optional)    → auto-migrated
  routes.ts    # Hono routes
  service.ts   # business logic
  validation.ts
```

The graph id is derived deterministically from the root `package.json` name and
the module directory name.

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

### How activation works

The project resolver discovers each direct `src/modules/<name>/index.ts`, admits
one project-root source using the root package name, and emits a static relative
import from `.voyant/runtime`. No nested `package.json`, package export, local
`voyant.ts`, config selection, or deployment binding is required.

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
                              # → migrations/NNNN_*.sql (custom tables + link tables)
pnpm db:migrate               # collector: framework bundle → deployment (incl. custom)
```

`db:generate:deployment` uses `drizzle.deployment-migrations.config.ts`, whose
schema glob (`./src/modules/*/schema.ts`) picks up every custom module. The full
`drizzle.config.ts` globs them too, so `db:push`, `db:studio`, and the
migration-replay oracle all see custom tables.

## Project subscribers and links

Application-local subscribers live under `src/subscribers/**/*.ts`. Each file
default-exports durable `EventFilterDescriptor` data with non-empty literal
`id` and `eventType` fields. Descriptor values must be serializable data; use a
workflow definition for executable behavior.

```ts
import type { EventFilterDescriptor } from "@voyant-travel/core"

export default {
  id: "loyalty.credit-booking-points",
  eventType: "booking.confirmed",
  manifest: {
    id: "loyalty.credit-booking-points",
    eventType: "booking.confirmed",
    payloadHash: "7dd9b0cbfd8c5e30",
    targetWorkflowId: "loyalty.credit-points",
  },
} satisfies EventFilterDescriptor
```

Application-local links live under `src/links/**/*.ts`. Each file imports
`defineLink` from `@voyant-travel/core` or `@voyant-travel/core/links` and
default-exports one definition:

```ts
import { defineLink } from "@voyant-travel/core"
import { booking } from "@voyant-travel/bookings/linkables"
import { loyaltyAccount } from "../modules/loyalty/linkables.js"

export default defineLink(booking, loyaltyAccount)
```

The build-time compiler parses these files without importing them, rejects
named runtime exports, project-root import escapes, invalid declaration shapes,
and duplicate subscriber IDs, then emits deterministic static imports in
`.voyant/runtime/project-subscribers.generated.ts` and
`.voyant/runtime/project-links.generated.ts`. Declaration and test files in
these directories are not convention entries. Runtime directory scanning is
not part of this contract.

## Custom routes on an *existing* module (extensions)

A `HonoExtension` adds routes to an **existing** module's surface (e.g. a
`/v1/admin/bookings/notes` endpoint on the standard `bookings` module) — as
opposed to a module, which is a whole new domain. Drop it in `src/extensions/`
and it's discovered + mounted the same way:

```ts
// src/extensions/booking-notes/index.ts
import { defineDeploymentExtension } from "@voyant-travel/framework"
import { bookingNotesRoutes } from "./routes.js"

export default defineDeploymentExtension({
  extension: { name: "booking-notes", module: "bookings" }, // target module
  adminRoutes: bookingNotesRoutes,                          // → /v1/admin/bookings/*
})
```

`extension.module` is the module the routes attach to. If the extension owns
tables, put them in `src/extensions/<name>/schema.ts` — the deployment drizzle
configs glob `src/extensions/*/schema.ts` too, so they migrate exactly like
custom-module schema. Discovery wires them via `extensionsFromGlob` in
`src/api/composition.ts` and passes them as `createVoyantApp({ extensions })`.

## Custom admin UI (pages, widgets, nav)

The same drop-a-folder discovery extends the **dashboard UI**. A directory under
`src/admin/<name>/` default-exporting an `AdminExtension` is auto-composed into
the admin shell — any of a custom **page**, a **widget** injected into a named
slot, or a **nav** entry:

```tsx
// src/admin/concierge/index.tsx
import { defineAdminExtension } from "@voyant-travel/admin"
import { ConciergePage } from "./page.js"
import { ConciergeWidget } from "./widget.js"

export default defineAdminExtension({
  id: "concierge",
  navigation: [{ items: [{ id: "concierge", title: "Concierge", url: "/concierge" }] }],
  widgets: [{ id: "concierge-kpi", slot: "dashboard.after-kpis", component: ConciergeWidget }],
  routes: [{ id: "concierge", path: "/concierge", title: "Concierge", component: ConciergePage }],
})
```

Each entry has exactly one `index.ts` or `index.tsx`; having both is an error.
Other files in the entry directory are supporting implementation and are not
discovered independently. Build-time analysis parses the entry without running
it, requires a default export, and emits the client-only
`.voyant/admin/project-admin.generated.ts` module with deterministic static
imports. The generated array is checked against `AdminExtension`, and duplicate
extension IDs are reported when their string values can be read statically.

`resolveProject()` owns this compilation. Its artifact contract uses paths
relative to the disposable `.voyant/` root, and project API route files are
also represented as individual API facets on a synthetic project-owned module.
Generated route and admin entry modules are therefore inputs to the same graph
resolution as package-owned facets, not separate starter scans.

- **nav + widgets** merge via `adminExtensionsFromGlob` in
  `src/lib/admin-extensions.tsx` and resolve through the shared
  `resolveAdminNavigation` / `resolveAdminWidgets`.
- **page routes** graft into the TanStack route tree at runtime in
  `src/router.tsx` (`buildAdminExtensionRoutes`). Discovered pages are reachable
  by string navigation (`<Link to="/concierge">`) — they're not in the generated
  typed-link map.

Widget slots are starter-defined strings (`dashboard.after-kpis`,
`booking.details.header`, `invoice.details.after-summary`, …). See
`starters/operator/src/admin/README.md`.

## Why it's upgrade-safe

Everything you write lives under the deployment's `src/` — the framework owns
none of it. `voyant upgrade` bumps `@voyant-travel/framework` (and its pinned
runtime set + migration bundle); your `src/modules/*` and your deployment
migration source (`migrations/`) are untouched. The collector's
content-hash ledger keys migrations by `(source, tag)`, so a framework upgrade
never re-runs or collides with your deployment migrations.

## Limits

- **Standard profile.** A custom module *adds* tables; it doesn't remove or
  re-shape framework tables. Arbitrary add/remove of *framework* modules is the
  D.2 (package-owned migrations) story — out of scope here.
- **Discovery is build-time.** A new module requires rebuilding and redeploying
  the Node application artifact. Unified Voyant deployments do not target
  Cloudflare Workers.
- **Table names are global.** A custom table can't reuse a framework table name
  (e.g. `booking_notes` already exists) — `pnpm db:migrate` fails fast with
  `relation "…" already exists`. Prefix deployment-owned tables (`acme_*`) to stay
  clear of the standard schema.

See also: `consolidated-deployments-rfc.md` (the seam catalog) and
`migration-collector-d1.md` (the deployment migration source + collector).
