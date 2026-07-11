import { describe, expect, it } from "vitest"

import { tripsModule, tripsService } from "../src/index.js"

describe("@voyant-travel/trips scaffold", () => {
  it("exports the module identity used by runtime installers", () => {
    expect(tripsModule.name).toBe("trips")
  })

  it("exposes a deterministic scaffold status", () => {
    expect(tripsService.getStatus()).toEqual({
      module: "trips",
      status: "scaffolded",
    })
  })
})
