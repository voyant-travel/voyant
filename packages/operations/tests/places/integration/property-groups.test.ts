import { describe, expect, it } from "vitest"

import { createFacilitiesTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Property group routes", () => {
  const ctx = createFacilitiesTestContext()

  describe("Property Groups", () => {
    it("creates a property group", async () => {
      const group = await ctx.seedPropertyGroup()
      expect(group.id).toMatch(/^pgrp_/)
      expect(group.groupType).toBe("chain")
      expect(group.status).toBe("active")
    })

    it("creates with all fields", async () => {
      const group = await ctx.seedPropertyGroup({
        groupType: "brand",
        code: "LUX",
        brandName: "Luxury Collection",
        legalName: "Luxury Corp Ltd",
        website: "https://luxury.com",
        notes: "Premium brand",
        metadata: { tier: "premium" },
      })
      expect(group.groupType).toBe("brand")
      expect(group.code).toBe("LUX")
      expect(group.brandName).toBe("Luxury Collection")
      expect(group.metadata).toEqual({ tier: "premium" })
    })

    it("gets a property group by id", async () => {
      const group = await ctx.seedPropertyGroup()
      const res = await ctx.request(`/property-groups/${group.id}`, { method: "GET" })
      expect(res.status).toBe(200)
    })

    it("returns 404 for non-existent property group", async () => {
      const res = await ctx.request("/property-groups/pgrp_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates a property group", async () => {
      const group = await ctx.seedPropertyGroup()
      const res = await ctx.request(`/property-groups/${group.id}`, {
        method: "PATCH",
        ...json({ status: "inactive", notes: "Suspended" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.status).toBe("inactive")
      expect(data.notes).toBe("Suspended")
    })

    it("deletes a property group", async () => {
      const group = await ctx.seedPropertyGroup()
      const res = await ctx.request(`/property-groups/${group.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)

      const check = await ctx.request(`/property-groups/${group.id}`, { method: "GET" })
      expect(check.status).toBe(404)
    })
  })

  describe("Property Groups list & filters", () => {
    it("lists with pagination", async () => {
      await ctx.seedPropertyGroup()
      await ctx.seedPropertyGroup()
      await ctx.seedPropertyGroup()
      const res = await ctx.request("/property-groups?limit=2", { method: "GET" })
      const body = await res.json()
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(3)
    })

    it("filters by groupType", async () => {
      await ctx.seedPropertyGroup({ groupType: "chain" })
      await ctx.seedPropertyGroup({ groupType: "brand" })
      const res = await ctx.request("/property-groups?groupType=brand", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
    })

    it("searches by name", async () => {
      await ctx.seedPropertyGroup({ name: "Hilton Hotels" })
      await ctx.seedPropertyGroup({ name: "Marriott Intl" })
      const res = await ctx.request("/property-groups?search=Hilton", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
    })
  })

  describe("Property Group Members", () => {
    it("creates a membership", async () => {
      const facility = await ctx.seedFacility()
      const property = await ctx.seedProperty(facility.id)
      const group = await ctx.seedPropertyGroup()

      const res = await ctx.request("/property-group-members", {
        method: "POST",
        ...json({ groupId: group.id, propertyId: property.id }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.id).toMatch(/^pgpm_/)
      expect(data.membershipRole).toBe("member")
    })

    it("creates with role and dates", async () => {
      const facility = await ctx.seedFacility()
      const property = await ctx.seedProperty(facility.id)
      const group = await ctx.seedPropertyGroup()

      const res = await ctx.request("/property-group-members", {
        method: "POST",
        ...json({
          groupId: group.id,
          propertyId: property.id,
          membershipRole: "flagship",
          isPrimary: true,
          validFrom: "2024-01-01",
        }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.membershipRole).toBe("flagship")
      expect(data.isPrimary).toBe(true)
    })

    it("returns 404 for non-existent group or property", async () => {
      const res = await ctx.request("/property-group-members", {
        method: "POST",
        ...json({
          groupId: "pgrp_00000000000000000000000000",
          propertyId: "prop_00000000000000000000000000",
        }),
      })
      expect(res.status).toBe(404)
    })

    it("gets a member by id", async () => {
      const facility = await ctx.seedFacility()
      const property = await ctx.seedProperty(facility.id)
      const group = await ctx.seedPropertyGroup()
      const createRes = await ctx.request("/property-group-members", {
        method: "POST",
        ...json({ groupId: group.id, propertyId: property.id }),
      })
      const { data: member } = await createRes.json()

      const res = await ctx.request(`/property-group-members/${member.id}`, { method: "GET" })
      expect(res.status).toBe(200)
    })

    it("updates a member", async () => {
      const facility = await ctx.seedFacility()
      const property = await ctx.seedProperty(facility.id)
      const group = await ctx.seedPropertyGroup()
      const createRes = await ctx.request("/property-group-members", {
        method: "POST",
        ...json({ groupId: group.id, propertyId: property.id }),
      })
      const { data: member } = await createRes.json()

      const res = await ctx.request(`/property-group-members/${member.id}`, {
        method: "PATCH",
        ...json({ membershipRole: "franchise", notes: "Converted" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.membershipRole).toBe("franchise")
      expect(data.notes).toBe("Converted")
    })

    it("deletes a member", async () => {
      const facility = await ctx.seedFacility()
      const property = await ctx.seedProperty(facility.id)
      const group = await ctx.seedPropertyGroup()
      const createRes = await ctx.request("/property-group-members", {
        method: "POST",
        ...json({ groupId: group.id, propertyId: property.id }),
      })
      const { data: member } = await createRes.json()

      const res = await ctx.request(`/property-group-members/${member.id}`, {
        method: "DELETE",
      })
      expect(res.status).toBe(200)

      const check = await ctx.request(`/property-group-members/${member.id}`, {
        method: "GET",
      })
      expect(check.status).toBe(404)
    })
  })

  describe("Property Group Members list & filters", () => {
    it("lists with filter by groupId", async () => {
      const facility1 = await ctx.seedFacility()
      const facility2 = await ctx.seedFacility()
      const property1 = await ctx.seedProperty(facility1.id)
      const property2 = await ctx.seedProperty(facility2.id)
      const group = await ctx.seedPropertyGroup()
      await ctx.request("/property-group-members", {
        method: "POST",
        ...json({ groupId: group.id, propertyId: property1.id }),
      })
      await ctx.request("/property-group-members", {
        method: "POST",
        ...json({ groupId: group.id, propertyId: property2.id }),
      })

      const res = await ctx.request(`/property-group-members?groupId=${group.id}`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.total).toBe(2)
    })

    it("filters by membershipRole", async () => {
      const facility1 = await ctx.seedFacility()
      const facility2 = await ctx.seedFacility()
      const property1 = await ctx.seedProperty(facility1.id)
      const property2 = await ctx.seedProperty(facility2.id)
      const group = await ctx.seedPropertyGroup()
      await ctx.request("/property-group-members", {
        method: "POST",
        ...json({ groupId: group.id, propertyId: property1.id, membershipRole: "member" }),
      })
      await ctx.request("/property-group-members", {
        method: "POST",
        ...json({ groupId: group.id, propertyId: property2.id, membershipRole: "flagship" }),
      })

      const res = await ctx.request(
        `/property-group-members?groupId=${group.id}&membershipRole=flagship`,
        { method: "GET" },
      )
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].membershipRole).toBe("flagship")
    })
  })
})
