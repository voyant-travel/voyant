import { describe, expect, it } from "vitest"

import { tripComposerHonoModule, tripComposerModule, tripComposerService } from "../src/index.js"

describe("@voyantjs/trip-composer scaffold", () => {
  it("exports the module identity used by runtime installers", () => {
    expect(tripComposerModule.name).toBe("trip-composer")
    expect(tripComposerHonoModule.module).toBe(tripComposerModule)
  })

  it("exposes a deterministic scaffold status", () => {
    expect(tripComposerService.getStatus()).toEqual({
      module: "trip-composer",
      status: "scaffolded",
    })
  })
})
