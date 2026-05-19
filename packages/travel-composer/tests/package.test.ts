import { describe, expect, it } from "vitest"

import {
  travelComposerHonoModule,
  travelComposerModule,
  travelComposerService,
} from "../src/index.js"

describe("@voyantjs/travel-composer scaffold", () => {
  it("exports the module identity used by runtime installers", () => {
    expect(travelComposerModule.name).toBe("travel-composer")
    expect(travelComposerHonoModule.module).toBe(travelComposerModule)
  })

  it("exposes a deterministic scaffold status", () => {
    expect(travelComposerService.getStatus()).toEqual({
      module: "travel-composer",
      status: "scaffolded",
    })
  })
})
