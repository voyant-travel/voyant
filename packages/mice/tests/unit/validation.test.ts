import { describe, expect, it } from "vitest"
import {
  createProgramSchema,
  programListQuerySchema,
  updateProgramSchema,
} from "../../src/validation.js"
import { createDelegateSchema, updateDelegateSchema } from "../../src/validation-delegates.js"
import {
  createBidSchema,
  createRfpSchema,
  updateBidSchema,
  updateRfpSchema,
} from "../../src/validation-rfp.js"
import {
  createSessionSchema,
  sessionListQuerySchema,
  updateSessionSchema,
} from "../../src/validation-sessions.js"

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

  it("accepts a valid program date range", () => {
    const parsed = createProgramSchema.parse({
      name: "Acme Kickoff",
      startDate: "2026-12-01",
      endDate: "2026-12-10",
    })
    expect(parsed.startDate).toBe("2026-12-01")
    expect(parsed.endDate).toBe("2026-12-10")
  })

  it("rejects program create when endDate is before startDate", () => {
    const result = createProgramSchema.safeParse({
      name: "Acme Kickoff",
      type: "meeting",
      startDate: "2026-12-10",
      endDate: "2026-12-01",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({
          path: ["endDate"],
          message: "endDate must be on or after startDate",
        }),
      ])
    }
  })

  it("rejects program patch when both provided dates are reversed", () => {
    const result = updateProgramSchema.safeParse({
      startDate: "2026-12-10",
      endDate: "2026-12-01",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({
          path: ["endDate"],
          message: "endDate must be on or after startDate",
        }),
      ])
    }
  })

  it("allows program patch payloads that omit one or both dates", () => {
    expect(updateProgramSchema.safeParse({}).success).toBe(true)
    expect(updateProgramSchema.safeParse({ startDate: "2026-12-10" }).success).toBe(true)
    expect(updateProgramSchema.safeParse({ endDate: "2026-12-01" }).success).toBe(true)
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

  it("applies defaults on related resource create schemas", () => {
    expect(createDelegateSchema.parse({ programId: "prog_1", personId: "person_1" })).toMatchObject(
      {
        role: "attendee",
        status: "invited",
      },
    )
    expect(createRfpSchema.parse({ programId: "prog_1", title: "Venue RFP" }).status).toBe("draft")
    expect(createBidSchema.parse({ supplierId: "sup_1" }).status).toBe("draft")
  })

  it("does not apply create-time enum defaults to empty patch payloads", () => {
    expect(updateProgramSchema.parse({})).not.toHaveProperty("status")
    expect(updateProgramSchema.parse({})).not.toHaveProperty("type")
    expect(updateSessionSchema.parse({})).not.toHaveProperty("sessionType")
    expect(updateDelegateSchema.parse({})).not.toHaveProperty("role")
    expect(updateDelegateSchema.parse({})).not.toHaveProperty("status")
    expect(updateRfpSchema.parse({})).not.toHaveProperty("status")
    expect(updateBidSchema.parse({})).not.toHaveProperty("status")
  })

  it("still accepts explicit lifecycle enum changes on patch", () => {
    expect(updateProgramSchema.parse({ status: "operating" }).status).toBe("operating")
    expect(updateSessionSchema.parse({ sessionType: "gala" }).sessionType).toBe("gala")
    expect(updateDelegateSchema.parse({ role: "vip", status: "confirmed" })).toMatchObject({
      role: "vip",
      status: "confirmed",
    })
    expect(updateRfpSchema.parse({ status: "issued" }).status).toBe("issued")
    expect(updateBidSchema.parse({ status: "under_review" }).status).toBe("under_review")
  })

  it("requires programId on session list", () => {
    expect(sessionListQuerySchema.safeParse({}).success).toBe(false)
    expect(sessionListQuerySchema.safeParse({ programId: "prog_1" }).success).toBe(true)
  })
})
