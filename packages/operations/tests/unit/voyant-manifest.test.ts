import { describe, expect, it } from "vitest"
import { operationsVoyantModule } from "../../src/voyant.js"

describe("operations deployment manifest", () => {
  it("owns the package deployment surfaces", () => {
    expect(operationsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/operations",
      packageName: "@voyant-travel/operations",
      api: [
        {
          id: "@voyant-travel/operations#api.admin",
          surface: "admin",
          openapi: { document: "operations" },
          runtime: { entry: "@voyant-travel/operations", export: "operationsHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/operations#schema" }],
      migrations: [{ id: "@voyant-travel/operations#migrations" }],
      links: [
        { id: "@voyant-travel/operations#linkable.departure" },
        { id: "@voyant-travel/operations#linkable.facility" },
        { id: "@voyant-travel/operations#linkable.functionSpace" },
        { id: "@voyant-travel/operations#linkable.property" },
        { id: "@voyant-travel/operations#linkable.spaceBlock" },
      ],
    })
  })

  it("authorizes the actual operations mount and every route method", () => {
    expect(operationsVoyantModule.access?.resources).toEqual([
      expect.objectContaining({
        resource: "operations",
        label: "Operations",
        description: expect.any(String),
        actions: [
          expect.objectContaining({
            action: "read",
            label: expect.any(String),
            description: expect.any(String),
          }),
          expect.objectContaining({
            action: "write",
            label: expect.any(String),
            description: expect.any(String),
          }),
          expect.objectContaining({
            action: "delete",
            label: expect.any(String),
            description: expect.any(String),
            sensitive: true,
          }),
        ],
      }),
    ])
  })
})
