// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import { z } from "zod"
import "../src/start"

describe("operator schema runtime", () => {
  it("disables Zod JIT so strict CSP does not report eval violations", () => {
    expect(z.config().jitless).toBe(true)
  })
})
