import { describe, expect, it } from "vitest"

import { createFacilitiesTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Facility operations routes", () => {
  const ctx = createFacilitiesTestContext()

  describe("Facility Features", () => {
    it("creates a feature for a facility", async () => {
      const facility = await ctx.seedFacility()
      const res = await ctx.request(`/operations/places/${facility.id}/features`, {
        method: "POST",
        ...json({ name: "Free WiFi", category: "amenity" }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.id).toMatch(/^ffea_/)
      expect(data.name).toBe("Free WiFi")
      expect(data.category).toBe("amenity")
    })

    it("returns 404 for non-existent facility", async () => {
      const res = await ctx.request("/operations/places/fac_00000000000000000000000000/features", {
        method: "POST",
        ...json({ name: "Pool", category: "amenity" }),
      })
      expect(res.status).toBe(404)
    })

    it("lists features with filter by facilityId", async () => {
      const facility = await ctx.seedFacility()
      await ctx.request(`/operations/places/${facility.id}/features`, {
        method: "POST",
        ...json({ name: "Pool", category: "amenity" }),
      })
      await ctx.request(`/operations/places/${facility.id}/features`, {
        method: "POST",
        ...json({ name: "Ramp Access", category: "accessibility" }),
      })

      const res = await ctx.request(`/facility-features?facilityId=${facility.id}`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.total).toBe(2)
    })

    it("filters features by category", async () => {
      const facility = await ctx.seedFacility()
      await ctx.request(`/operations/places/${facility.id}/features`, {
        method: "POST",
        ...json({ name: "Pool", category: "amenity" }),
      })
      await ctx.request(`/operations/places/${facility.id}/features`, {
        method: "POST",
        ...json({ name: "Guards", category: "security" }),
      })

      const res = await ctx.request(
        `/facility-features?facilityId=${facility.id}&category=security`,
        { method: "GET" },
      )
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].name).toBe("Guards")
    })

    it("updates a feature", async () => {
      const facility = await ctx.seedFacility()
      const createRes = await ctx.request(`/operations/places/${facility.id}/features`, {
        method: "POST",
        ...json({ name: "Gym", category: "amenity" }),
      })
      const { data: feature } = await createRes.json()

      const res = await ctx.request(`/facility-features/${feature.id}`, {
        method: "PATCH",
        ...json({ highlighted: true }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.highlighted).toBe(true)
    })

    it("deletes a feature", async () => {
      const facility = await ctx.seedFacility()
      const createRes = await ctx.request(`/operations/places/${facility.id}/features`, {
        method: "POST",
        ...json({ name: "Spa", category: "service" }),
      })
      const { data: feature } = await createRes.json()

      const res = await ctx.request(`/facility-features/${feature.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })
  })

  describe("Facility Operation Schedules", () => {
    it("creates a schedule for a facility", async () => {
      const facility = await ctx.seedFacility()
      const res = await ctx.request(`/operations/places/${facility.id}/operation-schedules`, {
        method: "POST",
        ...json({ dayOfWeek: "monday", opensAt: "08:00", closesAt: "22:00" }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.id).toMatch(/^fops_/)
      expect(data.dayOfWeek).toBe("monday")
      expect(data.opensAt).toBe("08:00")
      expect(data.closesAt).toBe("22:00")
    })

    it("creates a closed-day schedule", async () => {
      const facility = await ctx.seedFacility()
      const res = await ctx.request(`/operations/places/${facility.id}/operation-schedules`, {
        method: "POST",
        ...json({ dayOfWeek: "sunday", closed: true }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.closed).toBe(true)
    })

    it("returns 404 for non-existent facility", async () => {
      const res = await ctx.request(
        "/operations/places/fac_00000000000000000000000000/operation-schedules",
        {
          method: "POST",
          ...json({ dayOfWeek: "monday", opensAt: "09:00", closesAt: "17:00" }),
        },
      )
      expect(res.status).toBe(404)
    })

    it("lists schedules with filter", async () => {
      const facility = await ctx.seedFacility()
      await ctx.request(`/operations/places/${facility.id}/operation-schedules`, {
        method: "POST",
        ...json({ dayOfWeek: "monday", opensAt: "08:00", closesAt: "22:00" }),
      })
      await ctx.request(`/operations/places/${facility.id}/operation-schedules`, {
        method: "POST",
        ...json({ dayOfWeek: "tuesday", opensAt: "08:00", closesAt: "22:00" }),
      })

      const res = await ctx.request(
        `/facility-operation-schedules?facilityId=${facility.id}&dayOfWeek=monday`,
        { method: "GET" },
      )
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].dayOfWeek).toBe("monday")
    })

    it("updates a schedule", async () => {
      const facility = await ctx.seedFacility()
      const createRes = await ctx.request(`/operations/places/${facility.id}/operation-schedules`, {
        method: "POST",
        ...json({ dayOfWeek: "friday", opensAt: "09:00", closesAt: "18:00" }),
      })
      const { data: schedule } = await createRes.json()

      const res = await ctx.request(`/facility-operation-schedules/${schedule.id}`, {
        method: "PATCH",
        ...json({ closesAt: "23:00" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.closesAt).toBe("23:00")
    })

    it("deletes a schedule", async () => {
      const facility = await ctx.seedFacility()
      const createRes = await ctx.request(`/operations/places/${facility.id}/operation-schedules`, {
        method: "POST",
        ...json({ dayOfWeek: "wednesday" }),
      })
      const { data: schedule } = await createRes.json()

      const res = await ctx.request(`/facility-operation-schedules/${schedule.id}`, {
        method: "DELETE",
      })
      expect(res.status).toBe(200)
    })
  })
})
