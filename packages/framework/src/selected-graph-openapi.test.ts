import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { VoyantGraphRouteBundle } from "@voyant-travel/core/project"
import type { LazyMount, ModuleMount } from "@voyant-travel/hono/openapi"
import { describe, expect, it } from "vitest"

import type { VoyantGraphRuntime, VoyantGraphRuntimeUnitLoader } from "./runtime-lowering.js"
import { buildSelectedGraphOpenApiDocuments } from "./selected-graph-openapi.js"

const options = { info: { title: "Selected graph", version: "1" } }

function documentedApp(paths: readonly string[]) {
  const app = new OpenAPIHono() as OpenAPIHono & {
    lazyMounts: LazyMount[]
    moduleMounts: ModuleMount[]
  }
  app.lazyMounts = []
  app.moduleMounts = []
  for (const path of paths) {
    app.openapi(
      createRoute({
        method: "get",
        path,
        responses: {
          200: {
            content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
            description: "OK",
          },
        },
      }),
      (context) => context.json({ ok: true }),
    )
  }
  return app
}

function methodSplitApp(path: string) {
  const app = documentedApp([])
  for (const method of ["get", "post"] as const) {
    app.openapi(
      createRoute({
        method,
        path,
        responses: {
          200: {
            content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
            description: "OK",
          },
        },
      }),
      (context) => context.json({ ok: true }),
    )
  }
  return app
}

function unit(
  id: string,
  routes: readonly VoyantGraphRouteBundle[],
  kind: "module" | "extension" | "plugin" = "module",
): VoyantGraphRuntimeUnitLoader {
  return {
    id,
    localId: id.split("/").at(-1)?.split("#").at(-1),
    kind,
    packageName: id.split("#")[0]!,
    order: 0,
    references: [],
    config: [],
    secrets: [],
    resources: [],
    providers: [],
    requiredPorts: [],
    runtimePorts: [],
    requiredRuntimePorts: [],
    accessScopes: [],
    tools: [],
    workflows: [],
    actions: [],
    selectedIds: {
      routes: routes.map(({ id }) => id),
      tools: [],
      workflows: [],
      events: [],
      webhooks: [],
    },
    routes: routes.map((route) => ({
      unitId: id,
      route,
      importEntry: route.runtime?.entry ?? id,
      load: async () => ({}),
    })),
    load: async () => [],
  }
}

function runtime(
  modules: readonly VoyantGraphRuntimeUnitLoader[],
  extensions: readonly VoyantGraphRuntimeUnitLoader[] = [],
  plugins: readonly VoyantGraphRuntimeUnitLoader[] = [],
): Pick<VoyantGraphRuntime, "modules" | "extensions" | "plugins"> {
  return { modules, extensions, plugins }
}

function route(
  id: string,
  mount: string,
  document?: string,
  methods?: VoyantGraphRouteBundle["methods"],
): VoyantGraphRouteBundle {
  return {
    id,
    surface: "admin",
    mount,
    ...(document ? { openapi: { document } } : {}),
    ...(methods ? { methods } : {}),
    runtime: { entry: id },
  }
}

describe("buildSelectedGraphOpenApiDocuments", () => {
  it("follows graph selection and removal without leaking unclaimed paths", async () => {
    const app = documentedApp(["/v1/admin/identity/contacts", "/v1/admin/bookings"])
    const identity = unit("@voyant-travel/identity", [
      route("@voyant-travel/identity#api.admin", "identity", "identity"),
    ])

    const selected = await buildSelectedGraphOpenApiDocuments({
      runtime: runtime([identity]),
      app,
      options,
    })

    expect([...selected.keys()]).toEqual(["identity"])
    expect(Object.keys(selected.get("identity")?.paths ?? {})).toEqual([
      "/v1/admin/identity/contacts",
    ])
    await expect(
      buildSelectedGraphOpenApiDocuments({ runtime: runtime([]), app, options }),
    ).resolves.toEqual(new Map())
  })

  it("normalizes relative mounts and replays lazy route registries", async () => {
    const app = documentedApp([])
    const lazy = documentedApp(["/addresses"])
    app.lazyMounts.push({ prefix: "/v1/admin/identity", load: async () => lazy })
    app.moduleMounts.push({
      moduleName: "identity",
      prefix: "/v1/admin/identity",
      load: async () => lazy,
    })
    const identity = unit("@voyant-travel/identity", [
      route("@voyant-travel/identity#api.admin", "identity", "identity", ["GET"]),
    ])

    const documents = await buildSelectedGraphOpenApiDocuments({
      runtime: runtime([identity]),
      app,
      options,
    })
    const operation = documents.get("identity")?.paths?.["/v1/admin/identity/addresses"]
      ?.get as Record<string, unknown>

    expect(operation).toMatchObject({
      operationId: "getAdminIdentityAddresses",
      "x-voyant-api-id": "@voyant-travel/identity#api.admin",
      "x-voyant-unit-id": "@voyant-travel/identity",
      "x-voyant-package-name": "@voyant-travel/identity",
    })
  })

  it("fails an opted-in bundle that owns no documented operations", async () => {
    const app = documentedApp(["/v1/admin/bookings"])
    const identity = unit("@voyant-travel/identity", [
      route("@voyant-travel/identity#api.admin", "identity", "identity"),
    ])

    await expect(
      buildSelectedGraphOpenApiDocuments({ runtime: runtime([identity]), app, options }),
    ).rejects.toThrow(/matched zero operations/)
  })

  it("fails duplicate document claims across all selected unit kinds", async () => {
    const app = documentedApp(["/v1/admin/identity", "/v1/admin/identity-extra"])
    const module = unit("@voyant-travel/identity", [
      route("@voyant-travel/identity#api.admin", "identity", "identity"),
    ])
    const extension = unit(
      "@acme/identity-extension",
      [route("@acme/identity-extension#api.admin", "identity-extra", "identity")],
      "extension",
    )

    await expect(
      buildSelectedGraphOpenApiDocuments({ runtime: runtime([module], [extension]), app, options }),
    ).rejects.toThrow(/document "identity" is claimed by both/)
  })

  it("fails overlapping mounts that claim the same path", async () => {
    const app = documentedApp(["/v1/admin/identity/contacts"])
    const identity = unit("@voyant-travel/identity", [
      route("@voyant-travel/identity#api.admin", "identity", "identity"),
      route("@voyant-travel/identity#api.contacts", "identity/contacts", "identity-contacts"),
    ])

    await expect(
      buildSelectedGraphOpenApiDocuments({ runtime: runtime([identity]), app, options }),
    ).rejects.toThrow(/path "\/v1\/admin\/identity\/contacts" method "GET" is claimed by both/)
  })

  it("allows separate bundles to claim different methods on the same path", async () => {
    const path = "/v1/admin/identity/contacts"
    const app = methodSplitApp(path)
    const identity = unit("@voyant-travel/identity", [
      route("@voyant-travel/identity#api.contacts.read", "identity", "identity-read", ["GET"]),
      route("@voyant-travel/identity#api.contacts.write", "identity", "identity-write", ["POST"]),
    ])

    const documents = await buildSelectedGraphOpenApiDocuments({
      runtime: runtime([identity]),
      app,
      options,
    })

    expect(Object.keys(documents.get("identity-read")?.paths?.[path] ?? {})).toEqual(["get"])
    expect(Object.keys(documents.get("identity-write")?.paths?.[path] ?? {})).toEqual(["post"])
  })
})
