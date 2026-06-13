import { describe, expect, it } from "vitest"

import { createBookingRequirementsTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Question and option routes", () => {
  const ctx = createBookingRequirementsTestContext()

  describe("Product Booking Questions", () => {
    const validQuestion = () => ({ productId: ctx.productId(), label: "Dietary needs?" })

    it("creates a question", async () => {
      const res = await ctx.request("/questions", { method: "POST", ...json(validQuestion()) })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.label).toBe("Dietary needs?")
      expect(body.data.target).toBe("booking")
      expect(body.data.fieldType).toBe("text")
      expect(body.data.id).toBeTruthy()
    })

    it("lists questions", async () => {
      await ctx.request("/questions", { method: "POST", ...json(validQuestion()) })
      const res = await ctx.request("/questions", { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
      expect(body.total).toBe(1)
    })

    it("gets a question by id", async () => {
      const createRes = await ctx.request("/questions", {
        method: "POST",
        ...json(validQuestion()),
      })
      const { data: created } = await createRes.json()
      const res = await ctx.request(`/questions/${created.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.label).toBe("Dietary needs?")
    })

    it("updates a question", async () => {
      const createRes = await ctx.request("/questions", {
        method: "POST",
        ...json(validQuestion()),
      })
      const { data: created } = await createRes.json()
      const res = await ctx.request(`/questions/${created.id}`, {
        method: "PATCH",
        ...json({ label: "Updated label" }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.label).toBe("Updated label")
    })

    it("deletes a question", async () => {
      const createRes = await ctx.request("/questions", {
        method: "POST",
        ...json(validQuestion()),
      })
      const { data: created } = await createRes.json()
      const res = await ctx.request(`/questions/${created.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent question", async () => {
      const res = await ctx.request("/questions/pbqq_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Question Options", () => {
    async function seedQuestion() {
      const res = await ctx.request("/questions", {
        method: "POST",
        ...json({
          productId: ctx.productId(),
          label: "Pick size",
          fieldType: "single_select",
        }),
      })
      return (await res.json()).data
    }

    it("creates a question option", async () => {
      const question = await seedQuestion()
      const res = await ctx.request("/question-options", {
        method: "POST",
        ...json({ productBookingQuestionId: question.id, value: "small", label: "Small" }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.value).toBe("small")
      expect(body.data.label).toBe("Small")
      expect(body.data.isDefault).toBe(false)
    })

    it("lists question options filtered by questionId", async () => {
      const question = await seedQuestion()
      await ctx.request("/question-options", {
        method: "POST",
        ...json({ productBookingQuestionId: question.id, value: "small", label: "Small" }),
      })
      const res = await ctx.request(`/question-options?productBookingQuestionId=${question.id}`, {
        method: "GET",
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.length).toBe(1)
    })

    it("CRUD cycle for question option", async () => {
      const question = await seedQuestion()
      const createRes = await ctx.request("/question-options", {
        method: "POST",
        ...json({ productBookingQuestionId: question.id, value: "medium", label: "Medium" }),
      })
      const { data: option } = await createRes.json()

      const getRes = await ctx.request(`/question-options/${option.id}`, { method: "GET" })
      expect(getRes.status).toBe(200)

      const updateRes = await ctx.request(`/question-options/${option.id}`, {
        method: "PATCH",
        ...json({ isDefault: true }),
      })
      expect((await updateRes.json()).data.isDefault).toBe(true)

      const deleteRes = await ctx.request(`/question-options/${option.id}`, {
        method: "DELETE",
      })
      expect((await deleteRes.json()).success).toBe(true)
    })

    it("returns 404 for non-existent question option", async () => {
      const res = await ctx.request("/question-options/bqop_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })
})
