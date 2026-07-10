import { describe, expect, it } from "vitest"
import { createAccommodationContentHonoExtension } from "../../src/routes-content.js"
import { accommodationsContentVoyantPlugin, accommodationsVoyantModule } from "../../src/voyant.js"

describe("accommodations deployment manifest", () => {
  it("owns its runtime, schema, migrations, and linkable", () => {
    expect(accommodationsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/accommodations",
      packageName: "@voyant-travel/accommodations",
      api: [
        {
          id: "@voyant-travel/accommodations#api",
          surface: "admin",
          mount: "accommodations",
          transactional: true,
          runtime: {
            entry: "@voyant-travel/accommodations",
            export: "accommodationsHonoModule",
          },
        },
      ],
      schema: [
        {
          id: "@voyant-travel/accommodations#schema",
          source: "@voyant-travel/accommodations/schema",
        },
      ],
      migrations: [{ id: "@voyant-travel/accommodations#migrations", source: "./migrations" }],
      links: [
        {
          id: "@voyant-travel/accommodations#linkable.roomBlock",
          source: "@voyant-travel/accommodations/linkables",
        },
      ],
    })
  })

  it("owns its catalog content extension", () => {
    expect(accommodationsContentVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/accommodations#content-extension",
      api: [
        {
          surface: "admin",
          mount: "accommodations",
          runtime: { export: "createAccommodationContentHonoExtension" },
        },
        {
          surface: "public",
          mount: "accommodations",
          runtime: { export: "createAccommodationContentHonoExtension" },
        },
      ],
    })

    const resolveRegistry = () => ({}) as never
    const extension = createAccommodationContentHonoExtension({
      admin: { resolveRegistry, defaultAcceptMachineTranslated: false },
      public: { resolveRegistry, defaultAcceptMachineTranslated: true },
    })
    expect(extension.extension).toMatchObject({ name: "content", module: "accommodations" })
    expect(extension.adminRoutes).toBeDefined()
    expect(extension.publicRoutes).toBeDefined()
  })
})
