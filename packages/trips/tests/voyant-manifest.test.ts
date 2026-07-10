import { describe, expect, it } from "vitest"

import { tripsVoyantModule } from "../src/voyant.js"

describe("trips deployment manifest", () => {
  it("owns the package deployment surfaces", () => {
    expect(tripsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/trips",
      packageName: "@voyant-travel/trips",
      api: [
        {
          id: "@voyant-travel/trips#api.admin",
          surface: "admin",
          transactional: true,
          runtime: { entry: "@voyant-travel/trips", export: "createTripsHonoModule" },
        },
        {
          id: "@voyant-travel/trips#api.public",
          surface: "public",
          transactional: true,
          runtime: { entry: "@voyant-travel/trips", export: "createTripsHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/trips#schema" }],
      migrations: [{ id: "@voyant-travel/trips#migrations" }],
    })
  })
})
