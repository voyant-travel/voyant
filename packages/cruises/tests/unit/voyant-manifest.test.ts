import { isGraphRuntimeFactory } from "@voyant-travel/core/project"
import { describe, expect, it } from "vitest"
import { createCruisesContentVoyantRuntime } from "../../src/graph-runtime.js"
import { createCruisesHonoModule } from "../../src/index.js"
import { createCruiseContentHonoExtension } from "../../src/routes-content.js"
import {
  cruisesBookingVoyantPlugin,
  cruisesContentVoyantPlugin,
  cruisesVoyantModule,
} from "../../src/voyant.js"

describe("cruises deployment manifest", () => {
  it("owns its transactional operator and anonymous storefront surfaces", () => {
    expect(cruisesVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/cruises",
      packageName: "@voyant-travel/cruises",
      api: [
        {
          surface: "admin",
          mount: "cruises",
          transactional: true,
          runtime: { export: "createCruisesHonoModule" },
        },
        {
          surface: "public",
          mount: "cruises",
          anonymous: true,
          transactional: true,
          runtime: { export: "createCruisesHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/cruises#schema", source: "@voyant-travel/cruises/schema" }],
      migrations: [{ id: "@voyant-travel/cruises#migrations", source: "./migrations" }],
      links: [
        { id: "@voyant-travel/cruises#linkable.cruise" },
        { id: "@voyant-travel/cruises#linkable.cruise_voyage_group" },
        { id: "@voyant-travel/cruises#linkable.cruise_sailing" },
        { id: "@voyant-travel/cruises#linkable.cruise_ship" },
      ],
    })
  })

  it("owns content and booking extensions", () => {
    expect(cruisesContentVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/cruises#content-extension",
      api: [
        {
          surface: "admin",
          mount: "cruises",
          runtime: { export: "createCruisesContentVoyantRuntime" },
        },
        {
          surface: "public",
          mount: "cruises",
          runtime: { export: "createCruisesContentVoyantRuntime" },
        },
      ],
      runtimePorts: [{ id: "cruises.content-runtime" }],
    })
    expect(cruisesBookingVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/cruises#booking-extension",
      api: [
        { surface: "admin", mount: "bookings", runtime: { export: "cruisesBookingExtension" } },
      ],
    })

    const resolveRegistry = () => ({}) as never
    const extension = createCruiseContentHonoExtension({
      admin: { resolveRegistry, defaultAcceptMachineTranslated: false, allowOwnedKeys: true },
      public: { resolveRegistry, defaultAcceptMachineTranslated: true, allowOwnedKeys: true },
    })
    expect(extension.extension).toMatchObject({ name: "content", module: "cruises" })
    expect(extension.adminRoutes).toBeDefined()
    expect(extension.publicRoutes).toBeDefined()
    expect(isGraphRuntimeFactory(createCruisesContentVoyantRuntime)).toBe(true)
  })

  it("preserves deployment-injected lazy route bridges", () => {
    const lazyAdminRoutes = async () => ({}) as never
    const lazyPublicRoutes = async () => ({}) as never
    const module = createCruisesHonoModule({ lazyAdminRoutes, lazyPublicRoutes, anonymous: true })
    expect(module).toMatchObject({ lazyAdminRoutes, lazyPublicRoutes, anonymous: true })
    expect(module.adminRoutes).toBeUndefined()
    expect(module.publicRoutes).toBeUndefined()
  })
})
