import { describe, expect, it } from "vitest"

import { createResourcesTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Slot assignment and closeout routes", () => {
  const ctx = createResourcesTestContext()

  describe("Slot Assignments", () => {
    it("POST /slot-assignments → 201", async () => {
      const product = await ctx.seedProductDirect()
      const slot = await ctx.seedAvailabilitySlotDirect(product.id)
      const assignment = await ctx.seedSlotAssignment(slot.id)
      expect(assignment.id).toMatch(/^resa_/)
      expect(assignment.slotId).toBe(slot.id)
      expect(assignment.status).toBe("reserved")
    })

    it("GET /slot-assignments/:id → 200", async () => {
      const product = await ctx.seedProductDirect()
      const slot = await ctx.seedAvailabilitySlotDirect(product.id)
      const assignment = await ctx.seedSlotAssignment(slot.id)
      const res = await ctx.request(`/slot-assignments/${assignment.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(assignment.id)
    })

    it("GET /slot-assignments/:id → 404 for missing", async () => {
      const res = await ctx.request("/slot-assignments/resa_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /slot-assignments/:id → 200", async () => {
      const product = await ctx.seedProductDirect()
      const slot = await ctx.seedAvailabilitySlotDirect(product.id)
      const assignment = await ctx.seedSlotAssignment(slot.id)
      const res = await ctx.request(`/slot-assignments/${assignment.id}`, {
        method: "PATCH",
        ...json({ status: "assigned", notes: "Confirmed" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("assigned")
      expect(body.data.notes).toBe("Confirmed")
    })

    it("PATCH /slot-assignments/:id → 404 for missing", async () => {
      const res = await ctx.request("/slot-assignments/resa_nonexistent", {
        method: "PATCH",
        ...json({ status: "assigned" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /slot-assignments/:id → 200", async () => {
      const product = await ctx.seedProductDirect()
      const slot = await ctx.seedAvailabilitySlotDirect(product.id)
      const assignment = await ctx.seedSlotAssignment(slot.id)
      const res = await ctx.request(`/slot-assignments/${assignment.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /slot-assignments/:id → 404 for missing", async () => {
      const res = await ctx.request("/slot-assignments/resa_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /slot-assignments → list with filters", async () => {
      const product = await ctx.seedProductDirect()
      const slot1 = await ctx.seedAvailabilitySlotDirect(product.id)
      const slot2 = await ctx.seedAvailabilitySlotDirect(product.id)
      await ctx.seedSlotAssignment(slot1.id)
      await ctx.seedSlotAssignment(slot2.id)

      const res = await ctx.request(`/slot-assignments?slotId=${slot1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })

    it("GET /slot-assignments → filter by status", async () => {
      const product = await ctx.seedProductDirect()
      const slot = await ctx.seedAvailabilitySlotDirect(product.id)
      await ctx.seedSlotAssignment(slot.id, { status: "reserved" })
      await ctx.seedSlotAssignment(slot.id, { status: "assigned" })

      const res = await ctx.request("/slot-assignments?status=assigned")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].status).toBe("assigned")
    })

    it("POST /slot-assignments/batch-update → 200", async () => {
      const product = await ctx.seedProductDirect()
      const slot = await ctx.seedAvailabilitySlotDirect(product.id)
      const a1 = await ctx.seedSlotAssignment(slot.id)
      const a2 = await ctx.seedSlotAssignment(slot.id)
      const res = await ctx.request("/slot-assignments/batch-update", {
        method: "POST",
        ...json({ ids: [a1.id, a2.id], patch: { status: "completed" } }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
    })

    it("POST /slot-assignments/batch-delete → 200", async () => {
      const product = await ctx.seedProductDirect()
      const slot = await ctx.seedAvailabilitySlotDirect(product.id)
      const a1 = await ctx.seedSlotAssignment(slot.id)
      const a2 = await ctx.seedSlotAssignment(slot.id)
      const res = await ctx.request("/slot-assignments/batch-delete", {
        method: "POST",
        ...json({ ids: [a1.id, a2.id] }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
    })
  })

  describe("Resource Closeouts", () => {
    it("POST /closeouts → 201", async () => {
      const resource = await ctx.seedResource()
      const closeout = await ctx.seedCloseout(resource.id)
      expect(closeout.id).toMatch(/^recl_/)
      expect(closeout.resourceId).toBe(resource.id)
      expect(closeout.dateLocal).toBe("2025-07-01")
    })

    it("GET /closeouts/:id → 200", async () => {
      const resource = await ctx.seedResource()
      const closeout = await ctx.seedCloseout(resource.id)
      const res = await ctx.request(`/closeouts/${closeout.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(closeout.id)
    })

    it("GET /closeouts/:id → 404 for missing", async () => {
      const res = await ctx.request("/closeouts/recl_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /closeouts/:id → 200", async () => {
      const resource = await ctx.seedResource()
      const closeout = await ctx.seedCloseout(resource.id)
      const res = await ctx.request(`/closeouts/${closeout.id}`, {
        method: "PATCH",
        ...json({ reason: "Maintenance", dateLocal: "2025-07-02" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.reason).toBe("Maintenance")
    })

    it("PATCH /closeouts/:id → 404 for missing", async () => {
      const res = await ctx.request("/closeouts/recl_nonexistent", {
        method: "PATCH",
        ...json({ reason: "Nope" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /closeouts/:id → 200", async () => {
      const resource = await ctx.seedResource()
      const closeout = await ctx.seedCloseout(resource.id)
      const res = await ctx.request(`/closeouts/${closeout.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /closeouts/:id → 404 for missing", async () => {
      const res = await ctx.request("/closeouts/recl_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /closeouts → list with filters", async () => {
      const r1 = await ctx.seedResource()
      const r2 = await ctx.seedResource()
      await ctx.seedCloseout(r1.id)
      await ctx.seedCloseout(r1.id, { dateLocal: "2025-07-02" })
      await ctx.seedCloseout(r2.id)

      const res = await ctx.request(`/closeouts?resourceId=${r1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("GET /closeouts → filter by dateLocal", async () => {
      const resource = await ctx.seedResource()
      await ctx.seedCloseout(resource.id, { dateLocal: "2025-07-01" })
      await ctx.seedCloseout(resource.id, { dateLocal: "2025-07-02" })

      const res = await ctx.request("/closeouts?dateLocal=2025-07-02")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].dateLocal).toBe("2025-07-02")
    })

    it("POST /closeouts/batch-update → 200", async () => {
      const resource = await ctx.seedResource()
      const c1 = await ctx.seedCloseout(resource.id)
      const c2 = await ctx.seedCloseout(resource.id, { dateLocal: "2025-07-02" })
      const res = await ctx.request("/closeouts/batch-update", {
        method: "POST",
        ...json({ ids: [c1.id, c2.id], patch: { reason: "Batch reason" } }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
    })

    it("POST /closeouts/batch-delete → 200", async () => {
      const resource = await ctx.seedResource()
      const c1 = await ctx.seedCloseout(resource.id)
      const c2 = await ctx.seedCloseout(resource.id, { dateLocal: "2025-07-02" })
      const res = await ctx.request("/closeouts/batch-delete", {
        method: "POST",
        ...json({ ids: [c1.id, c2.id] }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.succeeded).toBe(2)
    })
  })
})
