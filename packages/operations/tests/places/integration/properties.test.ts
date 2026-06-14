import { describe, expect, it } from "vitest"

import { createFacilitiesTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Property routes", () => {
  const ctx = createFacilitiesTestContext()

  describe("Properties", () => {
    it("creates a property linked to a facility", async () => {
      const facility = await ctx.seedFacility({ kind: "hotel" })
      const property = await ctx.seedProperty(facility.id)
      expect(property.id).toMatch(/^prop_/)
      expect(property.facilityId).toBe(facility.id)
      expect(property.propertyType).toBe("hotel")
    })

    it("creates a property with all fields", async () => {
      const facility = await ctx.seedFacility({ kind: "resort" })
      const property = await ctx.seedProperty(facility.id, {
        propertyType: "resort",
        brandName: "Luxury Resorts",
        groupName: "LR Group",
        rating: 5,
        ratingScale: 5,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        policyNotes: "No pets",
      })
      expect(property.propertyType).toBe("resort")
      expect(property.brandName).toBe("Luxury Resorts")
      expect(property.rating).toBe(5)
      expect(property.checkInTime).toBe("15:00")
    })

    it("returns 404 when creating property for non-existent facility", async () => {
      const res = await ctx.request("/properties", {
        method: "POST",
        ...json({ facilityId: "fac_00000000000000000000000000" }),
      })
      expect(res.status).toBe(404)
    })

    it("gets a property by id", async () => {
      const facility = await ctx.seedFacility()
      const property = await ctx.seedProperty(facility.id)
      const res = await ctx.request(`/properties/${property.id}`, { method: "GET" })
      expect(res.status).toBe(200)
    })

    it("returns 404 for non-existent property", async () => {
      const res = await ctx.request("/properties/prop_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates a property", async () => {
      const facility = await ctx.seedFacility()
      const property = await ctx.seedProperty(facility.id)
      const res = await ctx.request(`/properties/${property.id}`, {
        method: "PATCH",
        ...json({ brandName: "New Brand", rating: 4 }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.brandName).toBe("New Brand")
      expect(data.rating).toBe(4)
    })

    it("deletes a property", async () => {
      const facility = await ctx.seedFacility()
      const property = await ctx.seedProperty(facility.id)
      const res = await ctx.request(`/properties/${property.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)

      const check = await ctx.request(`/properties/${property.id}`, { method: "GET" })
      expect(check.status).toBe(404)
    })
  })

  describe("Properties list & filters", () => {
    it("lists with pagination", async () => {
      const facility1 = await ctx.seedFacility()
      const facility2 = await ctx.seedFacility()
      const facility3 = await ctx.seedFacility()
      await ctx.seedProperty(facility1.id)
      await ctx.seedProperty(facility2.id)
      await ctx.seedProperty(facility3.id)

      const res = await ctx.request("/properties?limit=2", { method: "GET" })
      const body = await res.json()
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(3)
    })

    it("filters by propertyType", async () => {
      const facility1 = await ctx.seedFacility()
      const facility2 = await ctx.seedFacility()
      await ctx.seedProperty(facility1.id, { propertyType: "hotel" })
      await ctx.seedProperty(facility2.id, { propertyType: "villa" })

      const res = await ctx.request("/properties?propertyType=villa", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].propertyType).toBe("villa")
    })

    it("searches by brand or group name", async () => {
      const facility1 = await ctx.seedFacility()
      const facility2 = await ctx.seedFacility()
      await ctx.seedProperty(facility1.id, { brandName: "Hilton" })
      await ctx.seedProperty(facility2.id, { brandName: "Marriott" })

      const res = await ctx.request("/properties?search=Hilton", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
    })
  })
})
