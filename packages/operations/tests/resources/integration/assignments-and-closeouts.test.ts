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
      expect(assignment.assignedAt).toBeTruthy()
      expect(assignment.status).toBe("reserved")
    })

    it("POST /slot-assignments → 404 for missing local references", async () => {
      const product = await ctx.seedProductDirect()
      const slot = await ctx.seedAvailabilitySlotDirect(product.id)
      const resource = await ctx.seedResource()
      const pool = await ctx.seedPool()

      const missingPool = await ctx.request("/slot-assignments", {
        method: "POST",
        ...json({ slotId: slot.id, poolId: "repo_missing", resourceId: resource.id }),
      })
      expect(missingPool.status).toBe(404)
      await expect(missingPool.json()).resolves.toEqual({ error: "Resource pool not found" })

      const missingResource = await ctx.request("/slot-assignments", {
        method: "POST",
        ...json({ slotId: slot.id, poolId: pool.id, resourceId: "reso_missing" }),
      })
      expect(missingResource.status).toBe(404)
      await expect(missingResource.json()).resolves.toEqual({ error: "Resource not found" })
    })

    it("POST /slot-assignments → 400 when poolId and resourceId are both null", async () => {
      const product = await ctx.seedProductDirect()
      const slot = await ctx.seedAvailabilitySlotDirect(product.id)
      const res = await ctx.request("/slot-assignments", {
        method: "POST",
        ...json({ slotId: slot.id, poolId: null, resourceId: null }),
      })
      expect(res.status).toBe(400)
    })

    it("POST /slot-assignments → 400 when releasedAt predates assignedAt", async () => {
      const product = await ctx.seedProductDirect()
      const slot = await ctx.seedAvailabilitySlotDirect(product.id)
      const pool = await ctx.seedPool()
      const res = await ctx.request("/slot-assignments", {
        method: "POST",
        ...json({
          slotId: slot.id,
          poolId: pool.id,
          status: "released",
          assignedAt: "2025-06-15T10:00:00.000Z",
          releasedAt: "2025-06-15T09:00:00.000Z",
        }),
      })
      expect(res.status).toBe(400)
    })

    it("POST /slot-assignments → 400 for incoherent status/releasedAt payloads", async () => {
      const product = await ctx.seedProductDirect()
      const slot = await ctx.seedAvailabilitySlotDirect(product.id)
      const pool = await ctx.seedPool()

      const releasedWithoutTimestamp = await ctx.request("/slot-assignments", {
        method: "POST",
        ...json({ slotId: slot.id, poolId: pool.id, status: "released" }),
      })
      expect(releasedWithoutTimestamp.status).toBe(400)

      const timestampWithoutReleasedStatus = await ctx.request("/slot-assignments", {
        method: "POST",
        ...json({
          slotId: slot.id,
          poolId: pool.id,
          status: "reserved",
          releasedAt: "2025-06-15T11:00:00.000Z",
        }),
      })
      expect(timestampWithoutReleasedStatus.status).toBe(400)
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

    it("PATCH /slot-assignments/:id → 400 when final lifecycle state is incoherent", async () => {
      const product = await ctx.seedProductDirect()
      const slot = await ctx.seedAvailabilitySlotDirect(product.id)
      const assignment = await ctx.seedSlotAssignment(slot.id, {
        assignedAt: "2025-06-15T10:00:00.000Z",
      })

      const releaseBeforeAssigned = await ctx.request(`/slot-assignments/${assignment.id}`, {
        method: "PATCH",
        ...json({ status: "released", releasedAt: "2025-06-15T09:00:00.000Z" }),
      })
      expect(releaseBeforeAssigned.status).toBe(400)

      const releasedWithoutTimestamp = await ctx.request(`/slot-assignments/${assignment.id}`, {
        method: "PATCH",
        ...json({ status: "released" }),
      })
      expect(releasedWithoutTimestamp.status).toBe(400)

      const timestampWithoutReleasedStatus = await ctx.request(
        `/slot-assignments/${assignment.id}`,
        {
          method: "PATCH",
          ...json({ releasedAt: "2025-06-15T11:00:00.000Z" }),
        },
      )
      expect(timestampWithoutReleasedStatus.status).toBe(400)
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

    it("POST /closeouts → 400 for inverted time windows", async () => {
      const resource = await ctx.seedResource()
      const res = await ctx.request("/closeouts", {
        method: "POST",
        ...json({
          resourceId: resource.id,
          dateLocal: "2025-07-01",
          startsAt: "2025-07-01T17:00:00.000Z",
          endsAt: "2025-07-01T09:00:00.000Z",
        }),
      })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toEqual({
        error: "Resource closeout startsAt must be before endsAt",
      })
    })

    it("POST /closeouts → 409 for duplicate time windows", async () => {
      const resource = await ctx.seedResource()
      const window = {
        dateLocal: "2025-07-01",
        startsAt: "2025-07-01T09:00:00.000Z",
        endsAt: "2025-07-01T12:00:00.000Z",
      }
      await ctx.seedCloseout(resource.id, window)

      const res = await ctx.request("/closeouts", {
        method: "POST",
        ...json({ resourceId: resource.id, ...window }),
      })

      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toEqual({
        error: "Resource closeout overlaps an existing closeout",
      })
    })

    it("POST /closeouts → 409 for overlapping time windows", async () => {
      const resource = await ctx.seedResource()
      await ctx.seedCloseout(resource.id, {
        startsAt: "2025-07-01T09:00:00.000Z",
        endsAt: "2025-07-01T12:00:00.000Z",
      })

      const res = await ctx.request("/closeouts", {
        method: "POST",
        ...json({
          resourceId: resource.id,
          dateLocal: "2025-07-01",
          startsAt: "2025-07-01T11:00:00.000Z",
          endsAt: "2025-07-01T13:00:00.000Z",
        }),
      })

      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toEqual({
        error: "Resource closeout overlaps an existing closeout",
      })
    })

    it("POST /closeouts → 201 for adjacent time windows", async () => {
      const resource = await ctx.seedResource()
      await ctx.seedCloseout(resource.id, {
        startsAt: "2025-07-01T09:00:00.000Z",
        endsAt: "2025-07-01T12:00:00.000Z",
      })

      const res = await ctx.request("/closeouts", {
        method: "POST",
        ...json({
          resourceId: resource.id,
          dateLocal: "2025-07-01",
          startsAt: "2025-07-01T12:00:00.000Z",
          endsAt: "2025-07-01T14:00:00.000Z",
        }),
      })

      expect(res.status).toBe(201)
    })

    it("POST /closeouts → 404 for missing resource", async () => {
      const res = await ctx.request("/closeouts", {
        method: "POST",
        ...json({ resourceId: "reso_missing", dateLocal: "2025-07-01" }),
      })

      expect(res.status).toBe(404)
      await expect(res.json()).resolves.toEqual({ error: "Resource not found" })
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

    it("PATCH /closeouts/:id → 400 when merged time window is inverted", async () => {
      const resource = await ctx.seedResource()
      const closeout = await ctx.seedCloseout(resource.id, {
        startsAt: "2025-07-01T09:00:00.000Z",
        endsAt: "2025-07-01T12:00:00.000Z",
      })

      const res = await ctx.request(`/closeouts/${closeout.id}`, {
        method: "PATCH",
        ...json({ startsAt: "2025-07-01T13:00:00.000Z" }),
      })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toEqual({
        error: "Resource closeout startsAt must be before endsAt",
      })
    })

    it("PATCH /closeouts/:id → 409 when merged time window overlaps another closeout", async () => {
      const resource = await ctx.seedResource()
      await ctx.seedCloseout(resource.id, {
        startsAt: "2025-07-01T09:00:00.000Z",
        endsAt: "2025-07-01T12:00:00.000Z",
      })
      const closeout = await ctx.seedCloseout(resource.id, {
        startsAt: "2025-07-01T13:00:00.000Z",
        endsAt: "2025-07-01T14:00:00.000Z",
      })

      const res = await ctx.request(`/closeouts/${closeout.id}`, {
        method: "PATCH",
        ...json({ startsAt: "2025-07-01T11:00:00.000Z" }),
      })

      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toEqual({
        error: "Resource closeout overlaps an existing closeout",
      })
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
