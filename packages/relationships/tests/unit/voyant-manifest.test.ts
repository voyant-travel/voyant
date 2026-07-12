import { createContainer, createEventBus } from "@voyant-travel/core"
import { assertPortConforms } from "@voyant-travel/core/project"
import { describe, expect, it, vi } from "vitest"
import { createRelationshipsVoyantRuntime, relationshipsRouteRuntimePort } from "../../src/index.js"
import { RELATIONSHIPS_ROUTE_RUNTIME_CONTAINER_KEY } from "../../src/route-runtime.js"
import { relationshipsRoutes } from "../../src/routes/index.js"
import { relationshipsVoyantModule } from "../../src/voyant.js"

describe("relationships deployment manifest", () => {
  it("owns the package deployment surfaces", () => {
    expect(relationshipsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/relationships",
      packageName: "@voyant-travel/relationships",
      runtimePorts: [{ id: "relationships.route-runtime" }],
      api: [
        {
          id: "@voyant-travel/relationships#api.admin",
          surface: "admin",
          mount: "relationships",
          openapi: { document: "relationships" },
          transactional: true,
          runtime: {
            entry: "@voyant-travel/relationships",
            export: "createRelationshipsVoyantRuntime",
          },
        },
      ],
      schema: [{ id: "@voyant-travel/relationships#schema" }],
      migrations: [{ id: "@voyant-travel/relationships#migrations" }],
      links: [
        { id: "@voyant-travel/relationships#linkable.organization" },
        { id: "@voyant-travel/relationships#linkable.person" },
      ],
    })
  })

  it("ships a typed route runtime port and package-owned graph factory", async () => {
    const customFields = vi.fn(async () => [])
    await expect(
      assertPortConforms(relationshipsRouteRuntimePort, { customFields }),
    ).resolves.toBeUndefined()
    await expect(
      assertPortConforms(relationshipsRouteRuntimePort, { customFields: true } as never),
    ).rejects.toThrow(/customFields/)

    const module = await createRelationshipsVoyantRuntime({
      unitId: relationshipsVoyantModule.id,
      projectConfig: {},
      api: relationshipsVoyantModule.api ?? [],
      hasPort: () => true,
      getPort: vi.fn(async () => ({ customFields })) as never,
    })
    const container = createContainer()
    await module.module.bootstrap?.({ bindings: {}, container, eventBus: createEventBus() })

    expect(module.module.requiresTransactionalDb).toBe(true)
    expect(module.adminRoutes).toBe(relationshipsRoutes)
    expect(container.resolve(RELATIONSHIPS_ROUTE_RUNTIME_CONTAINER_KEY)).toMatchObject({
      customFields,
    })
  })

  it("declares the packaged relationships admin routes and person-detail slot", () => {
    expect(relationshipsVoyantModule.admin).toEqual({
      routes: [
        ["people-index", "/people"],
        ["people-detail", "/people/$id"],
        ["organizations-index", "/organizations"],
        ["organizations-detail", "/organizations/$id"],
      ].map(([id, path]) => ({
        id: `@voyant-travel/relationships#admin.route.${id}`,
        path,
        runtime: {
          entry: "@voyant-travel/relationships-react/admin",
          export: "createRelationshipsAdminExtension",
        },
      })),
      slots: [
        {
          id: "person.details.bookings-tab",
          routeId: "@voyant-travel/relationships#admin.route.people-detail",
          contract: { personId: "string" },
        },
      ],
    })
  })
})
