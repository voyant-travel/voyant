import { describe, expect, it } from "vitest"

import { createBookingRequirementsTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Booking answer routes", () => {
  const ctx = createBookingRequirementsTestContext()

  describe("Booking Answers", () => {
    async function seedQuestion() {
      const res = await ctx.request("/questions", {
        method: "POST",
        ...json({ productId: ctx.productId(), label: "Name?" }),
      })
      return (await res.json()).data
    }

    it("creates an answer", async () => {
      const question = await seedQuestion()
      const res = await ctx.request("/answers", {
        method: "POST",
        ...json({
          bookingId: ctx.bookingId(),
          productBookingQuestionId: question.id,
          valueText: "John Doe",
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.valueText).toBe("John Doe")
      expect(body.data.target).toBe("booking")
    })

    it("lists answers filtered by bookingId", async () => {
      const question = await seedQuestion()
      await ctx.request("/answers", {
        method: "POST",
        ...json({
          bookingId: ctx.bookingId(),
          productBookingQuestionId: question.id,
          valueText: "Jane",
        }),
      })
      const res = await ctx.request(`/answers?bookingId=${ctx.bookingId()}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.length).toBe(1)
    })

    it("CRUD cycle for answer", async () => {
      const question = await seedQuestion()
      const createRes = await ctx.request("/answers", {
        method: "POST",
        ...json({
          bookingId: ctx.bookingId(),
          productBookingQuestionId: question.id,
          valueText: "Initial",
        }),
      })
      const { data: answer } = await createRes.json()

      const getRes = await ctx.request(`/answers/${answer.id}`, { method: "GET" })
      expect(getRes.status).toBe(200)

      const updateRes = await ctx.request(`/answers/${answer.id}`, {
        method: "PATCH",
        ...json({ valueText: "Updated" }),
      })
      expect((await updateRes.json()).data.valueText).toBe("Updated")

      const deleteRes = await ctx.request(`/answers/${answer.id}`, { method: "DELETE" })
      expect((await deleteRes.json()).success).toBe(true)
    })

    it("returns 404 for non-existent answer", async () => {
      const res = await ctx.request("/answers/bqan_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })
})
