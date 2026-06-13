import { describe, expect, it } from "vitest"

import { createBookingRequirementsTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Trigger routes", () => {
  const ctx = createBookingRequirementsTestContext()

  describe("Option Booking Questions", () => {
    async function seedQuestion() {
      const res = await ctx.request("/questions", {
        method: "POST",
        ...json({ productId: ctx.productId(), label: "Allergies?" }),
      })
      return (await res.json()).data
    }

    it("creates an option booking question", async () => {
      const question = await seedQuestion()
      const res = await ctx.request("/option-questions", {
        method: "POST",
        ...json({ optionId: ctx.optionId(), productBookingQuestionId: question.id }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.optionId).toBe(ctx.optionId())
      expect(body.data.productBookingQuestionId).toBe(question.id)
    })

    it("CRUD cycle for option booking question", async () => {
      const question = await seedQuestion()
      const createRes = await ctx.request("/option-questions", {
        method: "POST",
        ...json({ optionId: ctx.optionId(), productBookingQuestionId: question.id }),
      })
      const { data: optionQuestion } = await createRes.json()

      const getRes = await ctx.request(`/option-questions/${optionQuestion.id}`, {
        method: "GET",
      })
      expect(getRes.status).toBe(200)

      const updateRes = await ctx.request(`/option-questions/${optionQuestion.id}`, {
        method: "PATCH",
        ...json({ isRequiredOverride: true }),
      })
      expect((await updateRes.json()).data.isRequiredOverride).toBe(true)

      const deleteRes = await ctx.request(`/option-questions/${optionQuestion.id}`, {
        method: "DELETE",
      })
      expect((await deleteRes.json()).success).toBe(true)
    })

    it("returns 404 for non-existent option booking question", async () => {
      const res = await ctx.request("/option-questions/obqq_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Unit Triggers", () => {
    async function seedQuestion() {
      const res = await ctx.request("/questions", {
        method: "POST",
        ...json({ productId: ctx.productId(), label: "Weight?" }),
      })
      return (await res.json()).data
    }

    it("creates a unit trigger", async () => {
      const question = await seedQuestion()
      const res = await ctx.request("/unit-triggers", {
        method: "POST",
        ...json({ productBookingQuestionId: question.id, unitId: ctx.unitId() }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.triggerMode).toBe("required")
      expect(body.data.active).toBe(true)
    })

    it("CRUD cycle for unit trigger", async () => {
      const question = await seedQuestion()
      const createRes = await ctx.request("/unit-triggers", {
        method: "POST",
        ...json({ productBookingQuestionId: question.id, unitId: ctx.unitId() }),
      })
      const { data: trigger } = await createRes.json()

      const getRes = await ctx.request(`/unit-triggers/${trigger.id}`, { method: "GET" })
      expect(getRes.status).toBe(200)

      const updateRes = await ctx.request(`/unit-triggers/${trigger.id}`, {
        method: "PATCH",
        ...json({ triggerMode: "optional" }),
      })
      expect((await updateRes.json()).data.triggerMode).toBe("optional")

      const deleteRes = await ctx.request(`/unit-triggers/${trigger.id}`, { method: "DELETE" })
      expect((await deleteRes.json()).success).toBe(true)
    })

    it("returns 404 for non-existent unit trigger", async () => {
      const res = await ctx.request("/unit-triggers/bqut_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Option Triggers", () => {
    async function seedQuestion() {
      const res = await ctx.request("/questions", {
        method: "POST",
        ...json({ productId: ctx.productId(), label: "Special request?" }),
      })
      return (await res.json()).data
    }

    it("creates an option trigger", async () => {
      const question = await seedQuestion()
      const res = await ctx.request("/option-triggers", {
        method: "POST",
        ...json({ productBookingQuestionId: question.id, optionId: ctx.optionId() }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.triggerMode).toBe("required")
    })

    it("CRUD cycle for option trigger", async () => {
      const question = await seedQuestion()
      const createRes = await ctx.request("/option-triggers", {
        method: "POST",
        ...json({ productBookingQuestionId: question.id, optionId: ctx.optionId() }),
      })
      const { data: trigger } = await createRes.json()

      const getRes = await ctx.request(`/option-triggers/${trigger.id}`, { method: "GET" })
      expect(getRes.status).toBe(200)

      const updateRes = await ctx.request(`/option-triggers/${trigger.id}`, {
        method: "PATCH",
        ...json({ triggerMode: "hidden" }),
      })
      expect((await updateRes.json()).data.triggerMode).toBe("hidden")

      const deleteRes = await ctx.request(`/option-triggers/${trigger.id}`, { method: "DELETE" })
      expect((await deleteRes.json()).success).toBe(true)
    })

    it("returns 404 for non-existent option trigger", async () => {
      const res = await ctx.request("/option-triggers/bqot_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Extra Triggers", () => {
    async function seedQuestion() {
      const res = await ctx.request("/questions", {
        method: "POST",
        ...json({ productId: ctx.productId(), label: "Extra info?" }),
      })
      return (await res.json()).data
    }

    it("creates an extra trigger", async () => {
      const question = await seedQuestion()
      const res = await ctx.request("/extra-triggers", {
        method: "POST",
        ...json({ productBookingQuestionId: question.id }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.triggerMode).toBe("required")
      expect(body.data.active).toBe(true)
    })

    it("CRUD cycle for extra trigger", async () => {
      const question = await seedQuestion()
      const createRes = await ctx.request("/extra-triggers", {
        method: "POST",
        ...json({ productBookingQuestionId: question.id }),
      })
      const { data: trigger } = await createRes.json()

      const getRes = await ctx.request(`/extra-triggers/${trigger.id}`, { method: "GET" })
      expect(getRes.status).toBe(200)

      const updateRes = await ctx.request(`/extra-triggers/${trigger.id}`, {
        method: "PATCH",
        ...json({ triggerMode: "optional", minQuantity: 3 }),
      })
      const updated = (await updateRes.json()).data
      expect(updated.triggerMode).toBe("optional")
      expect(updated.minQuantity).toBe(3)

      const deleteRes = await ctx.request(`/extra-triggers/${trigger.id}`, { method: "DELETE" })
      expect((await deleteRes.json()).success).toBe(true)
    })

    it("returns 404 for non-existent extra trigger", async () => {
      const res = await ctx.request("/extra-triggers/bqet_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })
})
