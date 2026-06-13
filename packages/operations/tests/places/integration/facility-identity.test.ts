import { describe, expect, it } from "vitest"

import { createFacilitiesTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Facility identity attachment routes", () => {
  const ctx = createFacilitiesTestContext()

  describe("Facility Contact Points", () => {
    it("creates and lists contact points for a facility", async () => {
      const facility = await ctx.seedFacility()
      const createRes = await ctx.request(`/operations/places/${facility.id}/contact-points`, {
        method: "POST",
        ...json({ kind: "phone", value: "+1-555-0100" }),
      })
      expect(createRes.status).toBe(201)
      const { data: contactPoint } = await createRes.json()
      expect(contactPoint.id).toMatch(/^idcp_/)
      expect(contactPoint.value).toBe("+1-555-0100")

      const listRes = await ctx.request(`/operations/places/${facility.id}/contact-points`, {
        method: "GET",
      })
      expect(listRes.status).toBe(200)
      const { data: list } = await listRes.json()
      expect(list.length).toBe(1)
    })

    it("returns 404 when creating contact point for non-existent facility", async () => {
      const res = await ctx.request(
        "/operations/places/fac_00000000000000000000000000/contact-points",
        {
          method: "POST",
          ...json({ kind: "email", value: "test@example.com" }),
        },
      )
      expect(res.status).toBe(404)
    })

    it("updates a contact point", async () => {
      const facility = await ctx.seedFacility()
      const createRes = await ctx.request(`/operations/places/${facility.id}/contact-points`, {
        method: "POST",
        ...json({ kind: "email", value: "old@example.com" }),
      })
      const { data: contactPoint } = await createRes.json()

      const res = await ctx.request(`/contact-points/${contactPoint.id}`, {
        method: "PATCH",
        ...json({ value: "new@example.com" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.value).toBe("new@example.com")
    })

    it("deletes a contact point", async () => {
      const facility = await ctx.seedFacility()
      const createRes = await ctx.request(`/operations/places/${facility.id}/contact-points`, {
        method: "POST",
        ...json({ kind: "website", value: "https://example.com" }),
      })
      const { data: contactPoint } = await createRes.json()

      const res = await ctx.request(`/contact-points/${contactPoint.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })
  })

  describe("Facility Addresses", () => {
    it("creates and lists addresses for a facility", async () => {
      const facility = await ctx.seedFacility()
      const createRes = await ctx.request(`/operations/places/${facility.id}/addresses`, {
        method: "POST",
        ...json({ label: "billing", line1: "456 Corp Ave", city: "London", country: "GB" }),
      })
      expect(createRes.status).toBe(201)
      const { data: address } = await createRes.json()
      expect(address.id).toMatch(/^idad_/)
      expect(address.city).toBe("London")

      const listRes = await ctx.request(`/operations/places/${facility.id}/addresses`, {
        method: "GET",
      })
      expect(listRes.status).toBe(200)
      const { data: list } = await listRes.json()
      expect(list.length).toBeGreaterThanOrEqual(1)
    })

    it("returns 404 when creating address for non-existent facility", async () => {
      const res = await ctx.request("/operations/places/fac_00000000000000000000000000/addresses", {
        method: "POST",
        ...json({ label: "primary", line1: "x" }),
      })
      expect(res.status).toBe(404)
    })

    it("updates an address", async () => {
      const facility = await ctx.seedFacility()
      const createRes = await ctx.request(`/operations/places/${facility.id}/addresses`, {
        method: "POST",
        ...json({ label: "primary", city: "Berlin" }),
      })
      const { data: address } = await createRes.json()

      const res = await ctx.request(`/addresses/${address.id}`, {
        method: "PATCH",
        ...json({ city: "Munich" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.city).toBe("Munich")
    })

    it("deletes an address", async () => {
      const facility = await ctx.seedFacility()
      const createRes = await ctx.request(`/operations/places/${facility.id}/addresses`, {
        method: "POST",
        ...json({ label: "shipping", line1: "789 Dock St" }),
      })
      const { data: address } = await createRes.json()

      const res = await ctx.request(`/addresses/${address.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })
  })

  describe("Facility Contacts", () => {
    it("creates a facility contact", async () => {
      const facility = await ctx.seedFacility()
      const res = await ctx.request(`/operations/places/${facility.id}/contacts`, {
        method: "POST",
        ...json({ name: "John Smith", role: "front_desk", email: "john@hotel.com" }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.id).toMatch(/^idnc_/)
      expect(data.name).toBe("John Smith")
      expect(data.role).toBe("front_desk")
    })

    it("returns 404 for non-existent facility", async () => {
      const res = await ctx.request("/operations/places/fac_00000000000000000000000000/contacts", {
        method: "POST",
        ...json({ name: "Nobody", role: "general" }),
      })
      expect(res.status).toBe(404)
    })

    it("lists facility contacts", async () => {
      const facility = await ctx.seedFacility()
      await ctx.request(`/operations/places/${facility.id}/contacts`, {
        method: "POST",
        ...json({ name: "Alice", role: "sales" }),
      })
      await ctx.request(`/operations/places/${facility.id}/contacts`, {
        method: "POST",
        ...json({ name: "Bob", role: "operations" }),
      })
      const res = await ctx.request(`/facility-contacts?facilityId=${facility.id}`, {
        method: "GET",
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.total).toBe(2)
    })

    it("updates a facility contact", async () => {
      const facility = await ctx.seedFacility()
      const createRes = await ctx.request(`/operations/places/${facility.id}/contacts`, {
        method: "POST",
        ...json({ name: "Jane Doe", role: "general" }),
      })
      const { data: contact } = await createRes.json()

      const res = await ctx.request(`/facility-contacts/${contact.id}`, {
        method: "PATCH",
        ...json({ name: "Jane Smith" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.name).toBe("Jane Smith")
    })

    it("deletes a facility contact", async () => {
      const facility = await ctx.seedFacility()
      const createRes = await ctx.request(`/operations/places/${facility.id}/contacts`, {
        method: "POST",
        ...json({ name: "Temp Contact", role: "other" }),
      })
      const { data: contact } = await createRes.json()

      const res = await ctx.request(`/facility-contacts/${contact.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })
  })
})
