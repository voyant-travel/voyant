import { describe, expect, it } from "vitest"

import { createProgramSchema, programListQuerySchema } from "../../src/validation.js"
import { createSessionSchema, sessionListQuerySchema } from "../../src/validation-sessions.js"

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

  it("defaults session type to breakout", () => {
    const parsed = createSessionSchema.parse({ programId: "prog_1", title: "Keynote" })
    expect(parsed.sessionType).toBe("breakout")
    expect(parsed.requiresRegistration).toBeUndefined()
  })

  it("requires programId on session list", () => {
    expect(sessionListQuerySchema.safeParse({}).success).toBe(false)
    expect(sessionListQuerySchema.safeParse({ programId: "prog_1" }).success).toBe(true)
  })
})
