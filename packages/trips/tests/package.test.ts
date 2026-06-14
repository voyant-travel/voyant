import { describe, expect, it } from "vitest"

import { tripsHonoModule, tripsModule, tripsService } from "../src/index.js"

describe("@voyantjs/trips scaffold", () => {
  it("exports the module identity used by runtime installers", () => {
    expect(tripsModule.name).toBe("trips")
    expect(tripsHonoModule.module).toBe(tripsModule)
  })

  it("exposes a deterministic scaffold status", () => {
    expect(tripsService.getStatus()).toEqual({
      module: "trips",
      status: "scaffolded",
    })
  })
})
