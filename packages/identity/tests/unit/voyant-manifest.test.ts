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
          resource: "identity",
          openapi: { document: "identity" },
          runtime: { entry: "@voyant-travel/identity", export: "identityHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/identity#schema" }],
      migrations: [{ id: "@voyant-travel/identity#migrations" }],
      access: {
        resources: [
          {
            id: "@voyant-travel/identity#access.identity",
            resource: "identity",
            label: "Identity",
            actions: expect.arrayContaining([
              expect.objectContaining({ action: "read" }),
              expect.objectContaining({ action: "write" }),
              expect.objectContaining({ action: "delete", sensitive: true }),
            ]),
          },
        ],
      },
    })
  })
})
