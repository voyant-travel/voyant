import { describe, expect, it } from "vitest"

import { createFacilitiesTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Facilities routes", () => {
  const ctx = createFacilitiesTestContext()

  describe("Facilities", () => {
    it("creates a facility with defaults", async () => {
      const facility = await ctx.seedFacility()
      expect(facility.id).toMatch(/^fac_/)
      expect(facility.kind).toBe("hotel")
      expect(facility.status).toBe("active")
    })

    it("creates a facility with address fields", async () => {
      const facility = await ctx.seedFacility({
        kind: "resort",
        addressLine1: "123 Beach Rd",
        city: "Cancun",
        country: "MX",
        latitude: 21.1619,
        longitude: -86.8515,
      })
      expect(facility.addressLine1).toBe("123 Beach Rd")
      expect(facility.city).toBe("Cancun")
      expect(facility.country).toBe("MX")
      expect(facility.latitude).toBe(21.1619)
      expect(facility.address).toContain("123 Beach Rd")
    })

    it("gets a facility by id", async () => {
      const facility = await ctx.seedFacility()
      const res = await ctx.request(`/operations/${facility.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.id).toBe(facility.id)
    })

    it("returns 404 for non-existent facility", async () => {
      const res = await ctx.request("/operations", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates a facility", async () => {
      const facility = await ctx.seedFacility()
      const res = await ctx.request(`/operations/${facility.id}`, {
        method: "PATCH",
        ...json({ name: "Updated Hotel", status: "inactive" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.name).toBe("Updated Hotel")
      expect(data.status).toBe("inactive")
    })

    it("updates facility address fields", async () => {
      const facility = await ctx.seedFacility({ city: "Paris" })
      const res = await ctx.request(`/operations/${facility.id}`, {
        method: "PATCH",
        ...json({ city: "Lyon" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.city).toBe("Lyon")
    })

    it("returns 404 when updating non-existent facility", async () => {
      const res = await ctx.request("/operations", {
        method: "PATCH",
        ...json({ name: "x" }),
      })
      expect(res.status).toBe(404)
    })

    it("deletes a facility", async () => {
      const facility = await ctx.seedFacility()
      const res = await ctx.request(`/operations/${facility.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)

      const check = await ctx.request(`/operations/${facility.id}`, { method: "GET" })
      expect(check.status).toBe(404)
    })

    it("returns 404 when deleting non-existent facility", async () => {
      const res = await ctx.request("/operations", {
        method: "DELETE",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Facilities list & filters", () => {
    it("lists with pagination", async () => {
      await ctx.seedFacility()
      await ctx.seedFacility()
      await ctx.seedFacility()
      const res = await ctx.request("/operations?limit=2", { method: "GET" })
      const body = await res.json()
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(3)
    })

    it("filters by kind", async () => {
      await ctx.seedFacility({ kind: "hotel" })
      await ctx.seedFacility({ kind: "airport" })
      const res = await ctx.request("/operations?kind=airport", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].kind).toBe("airport")
    })

    it("filters by status", async () => {
      await ctx.seedFacility({ status: "active" })
      await ctx.seedFacility({ status: "archived" })
      const res = await ctx.request("/operations?status=archived", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].status).toBe("archived")
    })

    it("searches by name", async () => {
      await ctx.seedFacility({ name: "Grand Hotel Plaza" })
      await ctx.seedFacility({ name: "Airport Lounge" })
      const res = await ctx.request("/operations?search=Grand", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].name).toBe("Grand Hotel Plaza")
    })
  })
})
