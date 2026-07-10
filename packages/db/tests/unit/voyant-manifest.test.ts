import { describe, expect, it } from "vitest"

import { dbVoyantModule } from "../../src/voyant.js"

describe("database deployment manifest", () => {
  it("owns the package schema and migrations", () => {
    expect(dbVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/db",
      packageName: "@voyant-travel/db",
      schema: [{ id: "@voyant-travel/db#schema", source: "@voyant-travel/db/schema" }],
      migrations: [{ id: "@voyant-travel/db#migrations", source: "./migrations" }],
    })
  })
})
