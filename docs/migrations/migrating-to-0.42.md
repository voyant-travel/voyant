# Migrating Framework to 0.42

Consolidated breaking-change notes for the Framework `0.42.0` release train.
This page covers migrations from `0.41.x` to `0.42.x`; patch-level changes and
dependency updates remain in the per-package `CHANGELOG.md` files.

> Long-jumping releases? See the [migrations index](./README.md) and apply each
> relevant page in release order.

---

## TL;DR

- `VoyantGraphRuntimeUnitDefinition.selectedIds` is required in Framework `0.42.x`.
- `VoyantGraphRuntimeRouteDefinition.referenceId` is required in Framework `0.42.x`.
- Every route reference ID must identify an admitted entry in its owning unit's `references` array.
- Voyant-generated graph runtime artifacts already provide both fields; normal generated projects need no source changes.
- Hand-authored `createVoyantGraphRuntime(...)` callers and direct runtime-loader fixtures must add the explicit metadata before upgrading from `0.41.x`.
- `deployment.providers.workflows` is now the only workflow-driver selector; Cloud credentials no longer select Voyant Cloud implicitly.
- The standard self-hosted Operator now selects durable Postgres workflows. Run `voyant migrate` before starting an upgraded self-hosted deployment.
- Managed Cloud deployment snapshots must select `voyant-cloud` before this runtime rolls out.

---

## Schema changes

The graph-runtime metadata change does not alter the database schema. Selecting
the `self-hosted` workflow provider adds the package-owned
`@voyant-travel/workflows-orchestrator#migrations` source to the generated
migration plan. It creates and upgrades the run, wakeup, and manifest tables.

Apply the plan before starting the upgraded server:

```sh
voyant migrate
```

The source is absent for `voyant-cloud` and `none`. Its SQL is idempotent so
applications that previously ran the orchestrator's standalone migrator can be
adopted into the unified Voyant migration ledger.

---

## Removed exports

No exported symbol was removed. Two previously optional properties are now
required:

| Type | Before (`0.41.x`) | After (`0.42.x`) |
|---|---|---|
| `VoyantGraphRuntimeUnitDefinition` | `selectedIds?: VoyantGraphRuntimeSelectedIds` | `selectedIds: VoyantGraphRuntimeSelectedIds` |
| `VoyantGraphRuntimeRouteDefinition` | `referenceId?: string` | `referenceId: string` |

Runtime lowering no longer synthesizes route references from `route.runtime`
or infers selected IDs from partial unit declarations and webhook plans.

The low-level `createVoyantNodeWorkflowDriver` API now accepts one options object
containing `deployment`, `env`, and `defaultAppSlug`. `createVoyantNodeApp` now
requires the resolved `deployment` input and no longer accepts an
`app.workflows` override.

---

## HTTP route changes

None. Route URLs, methods, mounts, authentication posture, and response
contracts are unchanged.

---

## Hook signature changes

None. No React hook signatures change in this Framework release.

---

## Caller-code migrations

### Workflow provider selection

Before, the Node runtime inferred the workflow driver from Cloud credentials and
otherwise used an in-memory driver. `self-hosted` and `none` declarations did not
control runtime behavior.

After, select the provider explicitly:

```ts
import { defineConfig } from "@voyant-travel/framework"

export default defineConfig({
  deployment: {
    mode: "self-hosted",
    providers: {
      workflows: "self-hosted",
    },
  },
})
```

Supported values are `voyant-cloud`, `self-hosted`, and `none`. Unknown or
missing values fail before application boot. `voyant-cloud` requires
`VOYANT_CLOUD_WORKFLOWS_URL` and `VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN`.
`self-hosted` requires Postgres outside local mode. `none` omits workflow
composition and scheduled workflow dispatch.

Workflow Runs admin routes use the same selection for control-plane ownership:
`self-hosted` enables tenant actions, `voyant-cloud` reserves actions for Cloud,
and `none` disables actions. The removed `VOYANT_WORKFLOW_ADMIN_SURFACE` package
config and Cloud credentials no longer influence selected-graph route behavior.

Managed Cloud deployment snapshots must declare:

```ts
providers: {
  workflows: "voyant-cloud",
}
```

Land and deploy that platform change before rolling out Framework 0.42. This
repository does not modify the platform snapshot. Resident self-hosted
applications retain their scheduler and Postgres time wheel; one-shot scheduled
dispatch disables both loops and shuts down its driver after triggering.

### Hand-authored runtime input

Generated `.voyant` runtime modules already emit this metadata. Only callers
that directly construct input for `createVoyantGraphRuntime(...)` need this
rewrite.

```ts
// Before - Framework 0.41.x
createVoyantGraphRuntime({
  graphHash: "sha256:example",
  entries: {
    "@acme/loyalty/runtime": () => import("@acme/loyalty/runtime"),
  },
  modules: [
    {
      id: "@acme/loyalty",
      kind: "module",
      packageName: "@acme/loyalty",
      order: 0,
      routes: [
        {
          route: {
            id: "@acme/loyalty#api.admin",
            surface: "admin",
            runtime: { entry: "./runtime", export: "createLoyaltyModule" },
          },
          importEntry: "@acme/loyalty/runtime",
        },
      ],
    },
  ],
  plugins: [],
})
```

```ts
// After - Framework 0.42.x
const unitId = "@acme/loyalty"
const routeId = "@acme/loyalty#api.admin"
const referenceId = "@acme/loyalty#api.admin:runtime"
const runtime = { entry: "./runtime", export: "createLoyaltyModule" }
const importEntry = "@acme/loyalty/runtime"

createVoyantGraphRuntime({
  graphHash: "sha256:example",
  entries: {
    [importEntry]: () => import("@acme/loyalty/runtime"),
  },
  modules: [
    {
      id: unitId,
      kind: "module",
      packageName: unitId,
      order: 0,
      references: [
        {
          id: referenceId,
          unitId,
          facet: "api",
          entityId: routeId,
          runtime,
          importEntry,
        },
      ],
      selectedIds: {
        routes: [routeId],
        tools: [],
        workflows: [],
        events: [],
        webhooks: [],
      },
      routes: [
        {
          route: { id: routeId, surface: "admin", runtime },
          importEntry,
          referenceId,
        },
      ],
    },
  ],
  plugins: [],
})
```

The route's `referenceId` must match the `id` of its `facet: "api"` runtime
reference. Do not generate a new ID at runtime or derive selected IDs from the
unit's other arrays.

### Direct runtime-loader fixtures

Tests that construct `VoyantGraphRuntimeUnitLoader` directly must also expose
the admitted reference loader. Empty units still need all five selected-ID
collections.

```ts
// Before - Framework 0.41.x
const unit = {
  id: "@fixture/identity",
  // other loader fields omitted
  references: [],
  routes: [{ route, importEntry, load: async () => moduleExport }],
}
```

```ts
// After - Framework 0.42.x
const referenceId = `${route.id}:runtime`
const unit = {
  id: "@fixture/identity",
  // other loader fields omitted
  references: [
    {
      id: referenceId,
      unitId: "@fixture/identity",
      facet: "api",
      entityId: route.id,
      runtime: route.runtime,
      importEntry,
      load: async () => moduleExport,
      loadModule: async () => ({ moduleExport }),
    },
  ],
  selectedIds: {
    routes: [route.id],
    tools: [],
    workflows: [],
    events: [],
    webhooks: [],
  },
  routes: [{ route, importEntry, referenceId, load: async () => moduleExport }],
}
```

---

## New capabilities

This release makes generated graph metadata the sole runtime-lowering contract,
so invalid partial inputs fail during typechecking or admission instead of being
reconstructed at runtime. It also makes the resolved deployment provider the
sole workflow-driver authority; environment variables configure the selected
provider but never select one.

---

## Per-package CHANGELOGs

For full detail, including patch-level changes and dependency updates not
listed here:

- [`@voyant-travel/framework@0.42.0`](../../packages/framework/CHANGELOG.md)
- [`@voyant-travel/core@0.122.0`](../../packages/core/CHANGELOG.md)
- [`@voyant-travel/runtime@0.8.0`](../../packages/runtime/CHANGELOG.md)
- [`@voyant-travel/operator-standard@0.3.0`](../../packages/operator-standard/CHANGELOG.md)
- [`@voyant-travel/workflows-orchestrator@0.119.0`](../../packages/workflows-orchestrator/CHANGELOG.md)
- [`@voyant-travel/workflow-runs@0.119.0`](../../packages/workflow-runs/CHANGELOG.md)
