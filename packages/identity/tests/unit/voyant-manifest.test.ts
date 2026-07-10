import { describe, expect, it } from "vitest"
import { identityVoyantModule } from "../../src/voyant.js"

describe("identity deployment manifest", () => {
  it("owns the package deployment surfaces", () => {
    expect(identityVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/identity",
      packageName: "@voyant-travel/identity",
      api: [
        {
          id: "@voyant-travel/identity#api.admin",
          surface: "admin",
          runtime: { entry: "@voyant-travel/identity", export: "identityHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/identity#schema" }],
      migrations: [{ id: "@voyant-travel/identity#migrations" }],
    })
  })
})
