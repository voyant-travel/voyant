import { describe, expect, it } from "vitest"

import { createProgramSchema, programListQuerySchema } from "../../src/validation.js"

describe("mice validation", () => {
  it("applies defaults on create", () => {
    const parsed = createProgramSchema.parse({ name: "Acme Kickoff" })
    expect(parsed.type).toBe("conference")
    expect(parsed.status).toBe("lead")
  })

  it("rejects a malformed start date", () => {
    const result = createProgramSchema.safeParse({ name: "x", startDate: "2026/01/01" })
    expect(result.success).toBe(false)
  })

  it("coerces + defaults list pagination", () => {
    const parsed = programListQuerySchema.parse({ limit: "25" })
    expect(parsed.limit).toBe(25)
    expect(parsed.offset).toBe(0)
  })
})
