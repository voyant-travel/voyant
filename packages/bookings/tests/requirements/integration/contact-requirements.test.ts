import { describe, expect, it } from "vitest"

import { createBookingRequirementsTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Contact requirement routes", () => {
  const ctx = createBookingRequirementsTestContext()

  describe("Contact Requirements", () => {
    const validReq = () => ({ productId: ctx.productId(), fieldKey: "email" })

    it("creates a contact requirement", async () => {
      const res = await ctx.request("/contact-requirements", {
        method: "POST",
        ...json(validReq()),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.fieldKey).toBe("email")
      expect(body.data.scope).toBe("traveler")
      expect(body.data.active).toBe(true)
      expect(body.data.id).toBeTruthy()
    })

    it("lists contact requirements", async () => {
      await ctx.request("/contact-requirements", { method: "POST", ...json(validReq()) })
      const res = await ctx.request("/contact-requirements", { method: "GET" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
      expect(body.total).toBe(1)
    })

    it("gets a contact requirement by id", async () => {
      const createRes = await ctx.request("/contact-requirements", {
        method: "POST",
        ...json(validReq()),
      })
      const { data: created } = await createRes.json()
      const res = await ctx.request(`/contact-requirements/${created.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      expect((await res.json()).data.fieldKey).toBe("email")
    })

    it("updates a contact requirement", async () => {
      const createRes = await ctx.request("/contact-requirements", {
        method: "POST",
        ...json(validReq()),
      })
      const { data: created } = await createRes.json()
      const res = await ctx.request(`/contact-requirements/${created.id}`, {
        method: "PATCH",
        ...json({ isRequired: true }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data.isRequired).toBe(true)
    })

    it("deletes a contact requirement", async () => {
      const createRes = await ctx.request("/contact-requirements", {
        method: "POST",
        ...json(validReq()),
      })
      const { data: created } = await createRes.json()
      const res = await ctx.request(`/contact-requirements/${created.id}`, {
        method: "DELETE",
      })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it("returns 404 for non-existent contact requirement", async () => {
      const res = await ctx.request("/contact-requirements/pcre_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })
  })
})
