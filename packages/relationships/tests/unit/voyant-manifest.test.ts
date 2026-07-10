import { describe, expect, it } from "vitest"
import { relationshipsVoyantModule } from "../../src/voyant.js"

describe("relationships deployment manifest", () => {
  it("owns the package deployment surfaces", () => {
    expect(relationshipsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/relationships",
      packageName: "@voyant-travel/relationships",
      api: [
        {
          id: "@voyant-travel/relationships#api.admin",
          surface: "admin",
          runtime: {
            entry: "@voyant-travel/relationships",
            export: "createRelationshipsHonoModule",
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
