# Migrating Framework to 0.42

Consolidated breaking-change notes for the Framework `0.42.0` release train.
This page covers migrations from `0.41.x` to `0.42.x`; patch-level changes and
dependency updates remain in the per-package `CHANGELOG.md` files.

> Merge-order note for maintainers: PR #3306 should extend this same `0.42`
> page after PR #3303 lands. Do not create a second Framework `0.42` migration
> page.

> Long-jumping releases? See the [migrations index](./README.md) and apply each
> relevant page in release order.

---

## TL;DR

- `VoyantGraphRuntimeUnitDefinition.selectedIds` is required in Framework `0.42.x`.
- `VoyantGraphRuntimeRouteDefinition.referenceId` is required in Framework `0.42.x`.
- Every route reference ID must identify an admitted entry in its owning unit's `references` array.
- Voyant-generated graph runtime artifacts already provide both fields; normal generated projects need no source changes.
- Hand-authored `createVoyantGraphRuntime(...)` callers and direct runtime-loader fixtures must add the explicit metadata before upgrading from `0.41.x`.

---

## Schema changes

None. This release does not add or remove database columns, enum values, or
constraints. No Drizzle migration is required for this Framework change.

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

---

## HTTP route changes

None. Route URLs, methods, mounts, authentication posture, and response
contracts are unchanged.

---

## Hook signature changes

None. No React hook signatures change in this Framework release.

---

## Caller-code migrations

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

This change adds no new authoring surface. It makes generated graph metadata
the sole runtime-lowering contract, so invalid partial inputs fail during
typechecking or admission instead of being reconstructed at runtime.

---

## Per-package CHANGELOGs

For full detail, including patch-level changes and dependency updates not
listed here:

- [`@voyant-travel/framework@0.42.0`](../../packages/framework/CHANGELOG.md)
