import { describe, expect, it } from "vitest"

import { setupVoyantModule } from "../../src/voyant.js"

describe("setup package manifest", () => {
  it("owns API, access, schema, migrations, and admin route", () => {
    expect(setupVoyantModule.api).toHaveLength(1)
    expect(setupVoyantModule.schema).toHaveLength(1)
    expect(setupVoyantModule.migrations).toHaveLength(1)
    expect(setupVoyantModule.access?.resources[0]?.resource).toBe("setup")
    expect(setupVoyantModule.admin?.routes?.[0]?.path).toBe("/setup")
  })
})
