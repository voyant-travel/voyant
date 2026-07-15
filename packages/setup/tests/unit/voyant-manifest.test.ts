import { describe, expect, it } from "vitest"

import { setupVoyantModule } from "../../src/voyant.js"

describe("setup package manifest", () => {
  it("owns API, access, schema, migrations, events, and admin route", () => {
    expect(setupVoyantModule.api).toHaveLength(1)
    expect(setupVoyantModule.schema).toHaveLength(1)
    expect(setupVoyantModule.migrations).toHaveLength(1)
    expect(setupVoyantModule.access?.resources[0]?.resource).toBe("setup")
    expect(setupVoyantModule.api?.[0]?.authorization).toBe("route")
    expect(setupVoyantModule.events).toEqual([
      expect.objectContaining({
        eventType: "setup.lifecycle.changed",
        version: "1.0.0",
        visibility: "internal",
        audit: { sourceModule: "setup", category: "internal" },
        payloadSchema: expect.objectContaining({
          required: ["change", "stepId"],
          additionalProperties: false,
        }),
      }),
    ])
    expect(setupVoyantModule.admin?.routes?.[0]?.path).toBe("/setup")
  })
})
