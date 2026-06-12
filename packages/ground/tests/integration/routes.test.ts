// agent-quality: file-size exception -- owner: ground; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { groundRoutes } from "../../src/routes.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

let seq = 0
function nextSeq() {
  seq++
  return String(seq).padStart(4, "0")
}

describe.skipIf(!DB_AVAILABLE)("Ground routes", () => {
  let app: Hono
  let db: ReturnType<typeof import("@voyantjs/db/test-utils").createTestDb>

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", groundRoutes)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
  })

  // ─── Seed Helpers ─────────────────────────────────────────

  async function seedResource(overrides: Record<string, unknown> = {}) {
    const { resources } = await import("@voyantjs/resources/schema")
    const [row] = await db
      .insert(resources)
      .values({ kind: "vehicle" as const, name: `Resource ${nextSeq()}`, ...overrides })
      .returning()
    return row!
  }

  async function seedBooking(overrides: Record<string, unknown> = {}) {
    const { bookings } = await import("@voyantjs/bookings/schema")
    const [row] = await db
      .insert(bookings)
      .values({ bookingNumber: `BK-${nextSeq()}`, sellCurrency: "USD", ...overrides })
      .returning()
    return row!
  }

  async function seedOperator(overrides: Record<string, unknown> = {}) {
    const body = { name: `Operator ${nextSeq()}`, ...overrides }
    const res = await app.request("/operators", { method: "POST", ...json(body) })
    expect(res.status).toBe(201)
    const { data } = await res.json()
    return data as { id: string; [k: string]: unknown }
  }

  async function seedVehicle(resourceId: string, overrides: Record<string, unknown> = {}) {
    const body = { resourceId, ...overrides }
    const res = await app.request("/vehicles", { method: "POST", ...json(body) })
    expect(res.status).toBe(201)
    const { data } = await res.json()
    return data as { id: string; resourceId: string; [k: string]: unknown }
  }

  async function seedDriver(resourceId: string, overrides: Record<string, unknown> = {}) {
    const body = { resourceId, ...overrides }
    const res = await app.request("/drivers", { method: "POST", ...json(body) })
    expect(res.status).toBe(201)
    const { data } = await res.json()
    return data as { id: string; resourceId: string; [k: string]: unknown }
  }

  async function seedTransferPreference(
    bookingId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const body = { bookingId, ...overrides }
    const res = await app.request("/transfer-preferences", { method: "POST", ...json(body) })
    expect(res.status).toBe(201)
    const { data } = await res.json()
    return data as { id: string; bookingId: string; [k: string]: unknown }
  }

  async function seedDispatch(
    transferPreferenceId: string,
    bookingId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const body = { transferPreferenceId, bookingId, ...overrides }
    const res = await app.request("/dispatches", { method: "POST", ...json(body) })
    expect(res.status).toBe(201)
    const { data } = await res.json()
    return data as { id: string; [k: string]: unknown }
  }

  /** Seeds the full chain: booking → transferPref → dispatch */
  async function seedDispatchChain(dispatchOverrides: Record<string, unknown> = {}) {
    const booking = await seedBooking()
    const transferPref = await seedTransferPreference(booking.id)
    const dispatch = await seedDispatch(transferPref.id, booking.id, dispatchOverrides)
    return { booking, transferPref, dispatch }
  }

  // ─── Operators ──────────────────────────────────────────────

  describe("Operators", () => {
    it("creates an operator with defaults", async () => {
      const op = await seedOperator()
      expect(op.id).toMatch(/^gopr_/)
      expect(op.active).toBe(true)
    })

    it("creates an operator with all fields", async () => {
      const op = await seedOperator({
        name: "Airport Transfers Ltd",
        code: "ATL",
        active: false,
        notes: "Premium operator",
      })
      expect(op.name).toBe("Airport Transfers Ltd")
      expect(op.code).toBe("ATL")
      expect(op.active).toBe(false)
      expect(op.notes).toBe("Premium operator")
    })

    it("gets an operator by id", async () => {
      const op = await seedOperator()
      const res = await app.request(`/operators/${op.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.id).toBe(op.id)
    })

    it("returns 404 for non-existent operator", async () => {
      const res = await app.request("/operators/gopr_00000000000000000000000000", { method: "GET" })
      expect(res.status).toBe(404)
    })

    it("updates an operator", async () => {
      const op = await seedOperator()
      const res = await app.request(`/operators/${op.id}`, {
        method: "PATCH",
        ...json({ name: "Updated Operator", active: false }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.name).toBe("Updated Operator")
      expect(data.active).toBe(false)
    })

    it("returns 404 when updating non-existent operator", async () => {
      const res = await app.request("/operators/gopr_00000000000000000000000000", {
        method: "PATCH",
        ...json({ name: "x" }),
      })
      expect(res.status).toBe(404)
    })

    it("deletes an operator", async () => {
      const op = await seedOperator()
      const res = await app.request(`/operators/${op.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)

      const check = await app.request(`/operators/${op.id}`, { method: "GET" })
      expect(check.status).toBe(404)
    })

    it("returns 404 when deleting non-existent operator", async () => {
      const res = await app.request("/operators/gopr_00000000000000000000000000", {
        method: "DELETE",
      })
      expect(res.status).toBe(404)
    })
  })

  describe("Operators list & filters", () => {
    it("lists with pagination", async () => {
      await seedOperator()
      await seedOperator()
      await seedOperator()
      const res = await app.request("/operators?limit=2", { method: "GET" })
      const body = await res.json()
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(3)
    })

    it("filters by active", async () => {
      await seedOperator({ active: true })
      await seedOperator({ active: false })
      const res = await app.request("/operators?active=false", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].active).toBe(false)
    })
  })

  // ─── Vehicles ───────────────────────────────────────────────

  describe("Vehicles", () => {
    it("creates a vehicle with defaults", async () => {
      const resource = await seedResource()
      const v = await seedVehicle(resource.id)
      expect(v.id).toMatch(/^gveh_/)
      expect(v.resourceId).toBe(resource.id)
      expect(v.category).toBe("other")
      expect(v.vehicleClass).toBe("standard")
      expect(v.active).toBe(true)
    })

    it("creates a vehicle with all fields", async () => {
      const resource = await seedResource()
      const v = await seedVehicle(resource.id, {
        category: "sedan",
        vehicleClass: "luxury",
        passengerCapacity: 4,
        checkedBagCapacity: 3,
        isAccessible: true,
        notes: "VIP sedan",
      })
      expect(v.category).toBe("sedan")
      expect(v.vehicleClass).toBe("luxury")
      expect(v.passengerCapacity).toBe(4)
      expect(v.isAccessible).toBe(true)
    })

    it("gets a vehicle by id", async () => {
      const resource = await seedResource()
      const v = await seedVehicle(resource.id)
      const res = await app.request(`/vehicles/${v.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.id).toBe(v.id)
    })

    it("returns 404 for non-existent vehicle", async () => {
      const res = await app.request("/vehicles/gveh_00000000000000000000000000", { method: "GET" })
      expect(res.status).toBe(404)
    })

    it("updates a vehicle", async () => {
      const resource = await seedResource()
      const v = await seedVehicle(resource.id)
      const res = await app.request(`/vehicles/${v.id}`, {
        method: "PATCH",
        ...json({ category: "suv", passengerCapacity: 7 }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.category).toBe("suv")
      expect(data.passengerCapacity).toBe(7)
    })

    it("deletes a vehicle", async () => {
      const resource = await seedResource()
      const v = await seedVehicle(resource.id)
      const res = await app.request(`/vehicles/${v.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)

      const check = await app.request(`/vehicles/${v.id}`, { method: "GET" })
      expect(check.status).toBe(404)
    })
  })

  describe("Vehicles list & filters", () => {
    it("lists with pagination", async () => {
      const r1 = await seedResource()
      const r2 = await seedResource()
      const r3 = await seedResource()
      await seedVehicle(r1.id)
      await seedVehicle(r2.id)
      await seedVehicle(r3.id)
      const res = await app.request("/vehicles?limit=2", { method: "GET" })
      const body = await res.json()
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(3)
    })

    it("filters by category", async () => {
      const r1 = await seedResource()
      const r2 = await seedResource()
      await seedVehicle(r1.id, { category: "sedan" })
      await seedVehicle(r2.id, { category: "bus" })
      const res = await app.request("/vehicles?category=bus", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].category).toBe("bus")
    })
  })

  // ─── Drivers ────────────────────────────────────────────────

  describe("Drivers", () => {
    it("creates a driver with defaults", async () => {
      const resource = await seedResource({ kind: "guide" as const })
      const d = await seedDriver(resource.id)
      expect(d.id).toMatch(/^gdrv_/)
      expect(d.resourceId).toBe(resource.id)
      expect(d.active).toBe(true)
      expect(d.isGuide).toBe(false)
    })

    it("creates a driver with all fields", async () => {
      const resource = await seedResource({ kind: "guide" as const })
      const d = await seedDriver(resource.id, {
        licenseNumber: "DL-12345",
        spokenLanguages: ["en", "es", "fr"],
        isGuide: true,
        isMeetAndGreetCapable: true,
        notes: "Experienced guide",
      })
      expect(d.licenseNumber).toBe("DL-12345")
      expect(d.spokenLanguages).toEqual(["en", "es", "fr"])
      expect(d.isGuide).toBe(true)
      expect(d.isMeetAndGreetCapable).toBe(true)
    })

    it("gets a driver by id", async () => {
      const resource = await seedResource({ kind: "guide" as const })
      const d = await seedDriver(resource.id)
      const res = await app.request(`/drivers/${d.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.id).toBe(d.id)
    })

    it("returns 404 for non-existent driver", async () => {
      const res = await app.request("/drivers/gdrv_00000000000000000000000000", { method: "GET" })
      expect(res.status).toBe(404)
    })

    it("updates a driver", async () => {
      const resource = await seedResource({ kind: "guide" as const })
      const d = await seedDriver(resource.id)
      const res = await app.request(`/drivers/${d.id}`, {
        method: "PATCH",
        ...json({ licenseNumber: "DL-99999", isGuide: true }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.licenseNumber).toBe("DL-99999")
      expect(data.isGuide).toBe(true)
    })

    it("deletes a driver", async () => {
      const resource = await seedResource({ kind: "guide" as const })
      const d = await seedDriver(resource.id)
      const res = await app.request(`/drivers/${d.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)

      const check = await app.request(`/drivers/${d.id}`, { method: "GET" })
      expect(check.status).toBe(404)
    })
  })

  describe("Drivers list & filters", () => {
    it("lists with pagination", async () => {
      const r1 = await seedResource({ kind: "guide" as const })
      const r2 = await seedResource({ kind: "guide" as const })
      const r3 = await seedResource({ kind: "guide" as const })
      await seedDriver(r1.id)
      await seedDriver(r2.id)
      await seedDriver(r3.id)
      const res = await app.request("/drivers?limit=2", { method: "GET" })
      const body = await res.json()
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(3)
    })

    it("filters by active", async () => {
      const r1 = await seedResource({ kind: "guide" as const })
      const r2 = await seedResource({ kind: "guide" as const })
      await seedDriver(r1.id, { active: true })
      await seedDriver(r2.id, { active: false })
      const res = await app.request("/drivers?active=false", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].active).toBe(false)
    })
  })

  // ─── Transfer Preferences ──────────────────────────────────

  describe("Transfer Preferences", () => {
    it("creates a transfer preference with defaults", async () => {
      const booking = await seedBooking()
      const tp = await seedTransferPreference(booking.id)
      expect(tp.id).toMatch(/^gtpr_/)
      expect(tp.bookingId).toBe(booking.id)
      expect(tp.serviceLevel).toBe("private")
      expect(tp.meetAndGreet).toBe(false)
    })

    it("creates with all fields", async () => {
      const booking = await seedBooking()
      const tp = await seedTransferPreference(booking.id, {
        requestedVehicleCategory: "sedan",
        requestedVehicleClass: "luxury",
        serviceLevel: "vip",
        passengerCount: 2,
        checkedBags: 4,
        meetAndGreet: true,
        driverLanguage: "en",
        pickupNotes: "Terminal 2",
        dropoffNotes: "Hotel lobby",
      })
      expect(tp.serviceLevel).toBe("vip")
      expect(tp.passengerCount).toBe(2)
      expect(tp.meetAndGreet).toBe(true)
      expect(tp.pickupNotes).toBe("Terminal 2")
    })

    it("gets a transfer preference by id", async () => {
      const booking = await seedBooking()
      const tp = await seedTransferPreference(booking.id)
      const res = await app.request(`/transfer-preferences/${tp.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.id).toBe(tp.id)
    })

    it("returns 404 for non-existent transfer preference", async () => {
      const res = await app.request("/transfer-preferences/gtpr_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates a transfer preference", async () => {
      const booking = await seedBooking()
      const tp = await seedTransferPreference(booking.id)
      const res = await app.request(`/transfer-preferences/${tp.id}`, {
        method: "PATCH",
        ...json({ serviceLevel: "shared", passengerCount: 6 }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.serviceLevel).toBe("shared")
      expect(data.passengerCount).toBe(6)
    })

    it("deletes a transfer preference", async () => {
      const booking = await seedBooking()
      const tp = await seedTransferPreference(booking.id)
      const res = await app.request(`/transfer-preferences/${tp.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)

      const check = await app.request(`/transfer-preferences/${tp.id}`, { method: "GET" })
      expect(check.status).toBe(404)
    })
  })

  describe("Transfer Preferences list & filters", () => {
    it("lists with pagination", async () => {
      const b1 = await seedBooking()
      const b2 = await seedBooking()
      const b3 = await seedBooking()
      await seedTransferPreference(b1.id)
      await seedTransferPreference(b2.id)
      await seedTransferPreference(b3.id)
      const res = await app.request("/transfer-preferences?limit=2", { method: "GET" })
      const body = await res.json()
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(3)
    })

    it("filters by bookingId", async () => {
      const b1 = await seedBooking()
      const b2 = await seedBooking()
      await seedTransferPreference(b1.id)
      await seedTransferPreference(b2.id)
      const res = await app.request(`/transfer-preferences?bookingId=${b1.id}`, { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].bookingId).toBe(b1.id)
    })

    it("filters by serviceLevel", async () => {
      const b1 = await seedBooking()
      const b2 = await seedBooking()
      await seedTransferPreference(b1.id, { serviceLevel: "private" })
      await seedTransferPreference(b2.id, { serviceLevel: "vip" })
      const res = await app.request("/transfer-preferences?serviceLevel=vip", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].serviceLevel).toBe("vip")
    })
  })

  // ─── Dispatches ─────────────────────────────────────────────

  describe("Dispatches", () => {
    it("creates a dispatch with defaults", async () => {
      const { dispatch } = await seedDispatchChain()
      expect(dispatch.id).toMatch(/^gdsp_/)
      expect(dispatch.status).toBe("draft")
    })

    it("creates a dispatch with timestamps", async () => {
      const booking = await seedBooking()
      const tp = await seedTransferPreference(booking.id)
      const d = await seedDispatch(tp.id, booking.id, {
        serviceDate: "2025-06-15",
        scheduledPickupAt: "2025-06-15T08:00:00Z",
        scheduledDropoffAt: "2025-06-15T09:30:00Z",
        status: "scheduled",
        passengerCount: 3,
      })
      expect(d.status).toBe("scheduled")
      expect(d.passengerCount).toBe(3)
    })

    it("gets a dispatch by id", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request(`/dispatches/${dispatch.id}`, { method: "GET" })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.id).toBe(dispatch.id)
    })

    it("returns 404 for non-existent dispatch", async () => {
      const res = await app.request("/dispatches/gdsp_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates a dispatch", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request(`/dispatches/${dispatch.id}`, {
        method: "PATCH",
        ...json({ status: "assigned", notes: "Driver confirmed" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.status).toBe("assigned")
      expect(data.notes).toBe("Driver confirmed")
    })

    it("deletes a dispatch", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request(`/dispatches/${dispatch.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)

      const check = await app.request(`/dispatches/${dispatch.id}`, { method: "GET" })
      expect(check.status).toBe(404)
    })
  })

  describe("Dispatches list & filters", () => {
    it("lists with pagination", async () => {
      await seedDispatchChain()
      await seedDispatchChain()
      await seedDispatchChain()
      const res = await app.request("/dispatches?limit=2", { method: "GET" })
      const body = await res.json()
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(3)
    })

    it("filters by status", async () => {
      await seedDispatchChain({ status: "draft" })
      await seedDispatchChain({ status: "scheduled" })
      const res = await app.request("/dispatches?status=scheduled", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].status).toBe("scheduled")
    })

    it("filters by bookingId", async () => {
      const { booking } = await seedDispatchChain()
      await seedDispatchChain()
      const res = await app.request(`/dispatches?bookingId=${booking.id}`, { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].bookingId).toBe(booking.id)
    })
  })

  // ─── Execution Events ──────────────────────────────────────

  describe("Execution Events", () => {
    it("creates an execution event with defaults", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request("/execution-events", {
        method: "POST",
        ...json({ dispatchId: dispatch.id }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.id).toMatch(/^gexe_/)
      expect(data.eventType).toBe("note")
    })

    it("creates with event type and notes", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request("/execution-events", {
        method: "POST",
        ...json({
          dispatchId: dispatch.id,
          eventType: "driver_arrived",
          notes: "Driver at gate B",
          metadata: { gate: "B" },
        }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.eventType).toBe("driver_arrived")
      expect(data.notes).toBe("Driver at gate B")
    })

    it("gets an execution event by id", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/execution-events", {
        method: "POST",
        ...json({ dispatchId: dispatch.id }),
      })
      const { data: ev } = await createRes.json()

      const res = await app.request(`/execution-events/${ev.id}`, { method: "GET" })
      expect(res.status).toBe(200)
    })

    it("returns 404 for non-existent execution event", async () => {
      const res = await app.request("/execution-events/gexe_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates an execution event", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/execution-events", {
        method: "POST",
        ...json({ dispatchId: dispatch.id }),
      })
      const { data: ev } = await createRes.json()

      const res = await app.request(`/execution-events/${ev.id}`, {
        method: "PATCH",
        ...json({ eventType: "pickup_completed", notes: "Picked up all passengers" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.eventType).toBe("pickup_completed")
    })

    it("deletes an execution event", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/execution-events", {
        method: "POST",
        ...json({ dispatchId: dispatch.id }),
      })
      const { data: ev } = await createRes.json()

      const res = await app.request(`/execution-events/${ev.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })
  })

  describe("Execution Events list & filters", () => {
    it("lists filtered by dispatchId", async () => {
      const { dispatch } = await seedDispatchChain()
      await app.request("/execution-events", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, eventType: "scheduled" }),
      })
      await app.request("/execution-events", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, eventType: "assigned" }),
      })
      const res = await app.request(`/execution-events?dispatchId=${dispatch.id}`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.total).toBe(2)
    })

    it("filters by eventType", async () => {
      const { dispatch } = await seedDispatchChain()
      await app.request("/execution-events", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, eventType: "scheduled" }),
      })
      await app.request("/execution-events", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, eventType: "issue" }),
      })
      const res = await app.request(`/execution-events?dispatchId=${dispatch.id}&eventType=issue`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].eventType).toBe("issue")
    })
  })

  // ─── Dispatch Assignments ──────────────────────────────────

  describe("Dispatch Assignments", () => {
    it("creates a dispatch assignment with defaults", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request("/dispatch-assignments", {
        method: "POST",
        ...json({ dispatchId: dispatch.id }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.id).toMatch(/^gdas_/)
      expect(data.assignmentSource).toBe("manual")
    })

    it("creates with source and notes", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request("/dispatch-assignments", {
        method: "POST",
        ...json({
          dispatchId: dispatch.id,
          assignmentSource: "auto",
          notes: "Auto-matched",
        }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.assignmentSource).toBe("auto")
      expect(data.notes).toBe("Auto-matched")
    })

    it("gets a dispatch assignment by id", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/dispatch-assignments", {
        method: "POST",
        ...json({ dispatchId: dispatch.id }),
      })
      const { data: assignment } = await createRes.json()

      const res = await app.request(`/dispatch-assignments/${assignment.id}`, { method: "GET" })
      expect(res.status).toBe(200)
    })

    it("returns 404 for non-existent assignment", async () => {
      const res = await app.request("/dispatch-assignments/gdas_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates a dispatch assignment", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/dispatch-assignments", {
        method: "POST",
        ...json({ dispatchId: dispatch.id }),
      })
      const { data: assignment } = await createRes.json()

      const res = await app.request(`/dispatch-assignments/${assignment.id}`, {
        method: "PATCH",
        ...json({ assignmentSource: "suggested", notes: "Operator suggested" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.assignmentSource).toBe("suggested")
    })

    it("deletes a dispatch assignment", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/dispatch-assignments", {
        method: "POST",
        ...json({ dispatchId: dispatch.id }),
      })
      const { data: assignment } = await createRes.json()

      const res = await app.request(`/dispatch-assignments/${assignment.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })
  })

  describe("Dispatch Assignments list & filters", () => {
    it("lists filtered by dispatchId", async () => {
      const { dispatch } = await seedDispatchChain()
      await app.request("/dispatch-assignments", {
        method: "POST",
        ...json({ dispatchId: dispatch.id }),
      })
      await app.request("/dispatch-assignments", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, assignmentSource: "auto" }),
      })
      const res = await app.request(`/dispatch-assignments?dispatchId=${dispatch.id}`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.total).toBe(2)
    })

    it("filters by assignmentSource", async () => {
      const { dispatch } = await seedDispatchChain()
      await app.request("/dispatch-assignments", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, assignmentSource: "manual" }),
      })
      await app.request("/dispatch-assignments", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, assignmentSource: "auto" }),
      })
      const res = await app.request(
        `/dispatch-assignments?dispatchId=${dispatch.id}&assignmentSource=auto`,
        { method: "GET" },
      )
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].assignmentSource).toBe("auto")
    })
  })

  // ─── Dispatch Legs ─────────────────────────────────────────

  describe("Dispatch Legs", () => {
    it("creates a dispatch leg with defaults", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request("/dispatch-legs", {
        method: "POST",
        ...json({ dispatchId: dispatch.id }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.id).toMatch(/^gdlg_/)
      expect(data.sequence).toBe(0)
      expect(data.legType).toBe("pickup")
    })

    it("creates with sequence and type", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request("/dispatch-legs", {
        method: "POST",
        ...json({
          dispatchId: dispatch.id,
          sequence: 1,
          legType: "dropoff",
          scheduledAt: "2025-06-15T09:30:00Z",
          notes: "Hotel entrance",
        }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.sequence).toBe(1)
      expect(data.legType).toBe("dropoff")
      expect(data.notes).toBe("Hotel entrance")
    })

    it("gets a dispatch leg by id", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/dispatch-legs", {
        method: "POST",
        ...json({ dispatchId: dispatch.id }),
      })
      const { data: leg } = await createRes.json()

      const res = await app.request(`/dispatch-legs/${leg.id}`, { method: "GET" })
      expect(res.status).toBe(200)
    })

    it("returns 404 for non-existent leg", async () => {
      const res = await app.request("/dispatch-legs/gdlg_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates a dispatch leg", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/dispatch-legs", {
        method: "POST",
        ...json({ dispatchId: dispatch.id }),
      })
      const { data: leg } = await createRes.json()

      const res = await app.request(`/dispatch-legs/${leg.id}`, {
        method: "PATCH",
        ...json({ legType: "stop", notes: "Rest stop" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.legType).toBe("stop")
    })

    it("deletes a dispatch leg", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/dispatch-legs", {
        method: "POST",
        ...json({ dispatchId: dispatch.id }),
      })
      const { data: leg } = await createRes.json()

      const res = await app.request(`/dispatch-legs/${leg.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })
  })

  describe("Dispatch Legs list & filters", () => {
    it("lists filtered by dispatchId", async () => {
      const { dispatch } = await seedDispatchChain()
      await app.request("/dispatch-legs", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, sequence: 0, legType: "pickup" }),
      })
      await app.request("/dispatch-legs", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, sequence: 1, legType: "dropoff" }),
      })
      const res = await app.request(`/dispatch-legs?dispatchId=${dispatch.id}`, { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(2)
    })

    it("filters by legType", async () => {
      const { dispatch } = await seedDispatchChain()
      await app.request("/dispatch-legs", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, legType: "pickup" }),
      })
      await app.request("/dispatch-legs", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, legType: "deadhead" }),
      })
      const res = await app.request(`/dispatch-legs?dispatchId=${dispatch.id}&legType=deadhead`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].legType).toBe("deadhead")
    })
  })

  // ─── Dispatch Passengers ───────────────────────────────────

  describe("Dispatch Passengers", () => {
    it("creates a dispatch passenger", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request("/dispatch-passengers", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, displayName: "John Doe", seatLabel: "1A" }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.id).toMatch(/^gdps_/)
      expect(data.displayName).toBe("John Doe")
      expect(data.seatLabel).toBe("1A")
    })

    it("gets a dispatch passenger by id", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/dispatch-passengers", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, displayName: "Jane Doe" }),
      })
      const { data: pax } = await createRes.json()

      const res = await app.request(`/dispatch-passengers/${pax.id}`, { method: "GET" })
      expect(res.status).toBe(200)
    })

    it("returns 404 for non-existent passenger", async () => {
      const res = await app.request("/dispatch-passengers/gdps_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates a dispatch passenger", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/dispatch-passengers", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, displayName: "John" }),
      })
      const { data: pax } = await createRes.json()

      const res = await app.request(`/dispatch-passengers/${pax.id}`, {
        method: "PATCH",
        ...json({ displayName: "John Smith", notes: "VIP" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.displayName).toBe("John Smith")
      expect(data.notes).toBe("VIP")
    })

    it("deletes a dispatch passenger", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/dispatch-passengers", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, displayName: "Temp Pax" }),
      })
      const { data: pax } = await createRes.json()

      const res = await app.request(`/dispatch-passengers/${pax.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })
  })

  describe("Dispatch Passengers list & filters", () => {
    it("lists filtered by dispatchId", async () => {
      const { dispatch } = await seedDispatchChain()
      await app.request("/dispatch-passengers", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, displayName: "Pax 1" }),
      })
      await app.request("/dispatch-passengers", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, displayName: "Pax 2" }),
      })
      const res = await app.request(`/dispatch-passengers?dispatchId=${dispatch.id}`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.total).toBe(2)
    })
  })

  // ─── Driver Shifts ─────────────────────────────────────────

  describe("Driver Shifts", () => {
    it("creates a driver shift with defaults", async () => {
      const resource = await seedResource({ kind: "guide" as const })
      const driver = await seedDriver(resource.id)
      const res = await app.request("/driver-shifts", {
        method: "POST",
        ...json({
          driverId: driver.id,
          startsAt: "2025-06-15T06:00:00Z",
          endsAt: "2025-06-15T18:00:00Z",
        }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.id).toMatch(/^gdsh_/)
      expect(data.status).toBe("scheduled")
    })

    it("creates with all fields", async () => {
      const resource = await seedResource({ kind: "guide" as const })
      const driver = await seedDriver(resource.id)
      const operator = await seedOperator()
      const res = await app.request("/driver-shifts", {
        method: "POST",
        ...json({
          driverId: driver.id,
          operatorId: operator.id,
          startsAt: "2025-06-15T06:00:00Z",
          endsAt: "2025-06-15T18:00:00Z",
          status: "available",
          notes: "Morning shift",
        }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.status).toBe("available")
      expect(data.notes).toBe("Morning shift")
    })

    it("gets a driver shift by id", async () => {
      const resource = await seedResource({ kind: "guide" as const })
      const driver = await seedDriver(resource.id)
      const createRes = await app.request("/driver-shifts", {
        method: "POST",
        ...json({
          driverId: driver.id,
          startsAt: "2025-06-15T06:00:00Z",
          endsAt: "2025-06-15T18:00:00Z",
        }),
      })
      const { data: shift } = await createRes.json()

      const res = await app.request(`/driver-shifts/${shift.id}`, { method: "GET" })
      expect(res.status).toBe(200)
    })

    it("returns 404 for non-existent shift", async () => {
      const res = await app.request("/driver-shifts/gdsh_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates a driver shift", async () => {
      const resource = await seedResource({ kind: "guide" as const })
      const driver = await seedDriver(resource.id)
      const createRes = await app.request("/driver-shifts", {
        method: "POST",
        ...json({
          driverId: driver.id,
          startsAt: "2025-06-15T06:00:00Z",
          endsAt: "2025-06-15T18:00:00Z",
        }),
      })
      const { data: shift } = await createRes.json()

      const res = await app.request(`/driver-shifts/${shift.id}`, {
        method: "PATCH",
        ...json({ status: "on_duty", notes: "Started early" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.status).toBe("on_duty")
      expect(data.notes).toBe("Started early")
    })

    it("deletes a driver shift", async () => {
      const resource = await seedResource({ kind: "guide" as const })
      const driver = await seedDriver(resource.id)
      const createRes = await app.request("/driver-shifts", {
        method: "POST",
        ...json({
          driverId: driver.id,
          startsAt: "2025-06-15T06:00:00Z",
          endsAt: "2025-06-15T18:00:00Z",
        }),
      })
      const { data: shift } = await createRes.json()

      const res = await app.request(`/driver-shifts/${shift.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })
  })

  describe("Driver Shifts list & filters", () => {
    it("lists filtered by driverId", async () => {
      const resource = await seedResource({ kind: "guide" as const })
      const driver = await seedDriver(resource.id)
      await app.request("/driver-shifts", {
        method: "POST",
        ...json({
          driverId: driver.id,
          startsAt: "2025-06-15T06:00:00Z",
          endsAt: "2025-06-15T18:00:00Z",
        }),
      })
      await app.request("/driver-shifts", {
        method: "POST",
        ...json({
          driverId: driver.id,
          startsAt: "2025-06-16T06:00:00Z",
          endsAt: "2025-06-16T18:00:00Z",
        }),
      })
      const res = await app.request(`/driver-shifts?driverId=${driver.id}`, { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(2)
    })

    it("filters by status", async () => {
      const r1 = await seedResource({ kind: "guide" as const })
      const r2 = await seedResource({ kind: "guide" as const })
      const d1 = await seedDriver(r1.id)
      const d2 = await seedDriver(r2.id)
      await app.request("/driver-shifts", {
        method: "POST",
        ...json({
          driverId: d1.id,
          startsAt: "2025-06-15T06:00:00Z",
          endsAt: "2025-06-15T18:00:00Z",
          status: "scheduled",
        }),
      })
      await app.request("/driver-shifts", {
        method: "POST",
        ...json({
          driverId: d2.id,
          startsAt: "2025-06-15T06:00:00Z",
          endsAt: "2025-06-15T18:00:00Z",
          status: "completed",
        }),
      })
      const res = await app.request("/driver-shifts?status=completed", { method: "GET" })
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].status).toBe("completed")
    })
  })

  // ─── Service Incidents ─────────────────────────────────────

  describe("Service Incidents", () => {
    it("creates a service incident with defaults", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request("/service-incidents", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, incidentType: "delay" }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.id).toMatch(/^gsin_/)
      expect(data.severity).toBe("warning")
      expect(data.resolutionStatus).toBe("open")
    })

    it("creates with all fields", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request("/service-incidents", {
        method: "POST",
        ...json({
          dispatchId: dispatch.id,
          incidentType: "vehicle_breakdown",
          severity: "critical",
          resolutionStatus: "open",
          notes: "Flat tire on highway",
        }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.severity).toBe("critical")
      expect(data.incidentType).toBe("vehicle_breakdown")
      expect(data.notes).toBe("Flat tire on highway")
    })

    it("gets a service incident by id", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/service-incidents", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, incidentType: "delay" }),
      })
      const { data: incident } = await createRes.json()

      const res = await app.request(`/service-incidents/${incident.id}`, { method: "GET" })
      expect(res.status).toBe(200)
    })

    it("returns 404 for non-existent incident", async () => {
      const res = await app.request("/service-incidents/gsin_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates a service incident", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/service-incidents", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, incidentType: "delay" }),
      })
      const { data: incident } = await createRes.json()

      const res = await app.request(`/service-incidents/${incident.id}`, {
        method: "PATCH",
        ...json({ resolutionStatus: "resolved", notes: "Issue fixed" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.resolutionStatus).toBe("resolved")
      expect(data.notes).toBe("Issue fixed")
    })

    it("deletes a service incident", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/service-incidents", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, incidentType: "delay" }),
      })
      const { data: incident } = await createRes.json()

      const res = await app.request(`/service-incidents/${incident.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })
  })

  describe("Service Incidents list & filters", () => {
    it("lists filtered by dispatchId", async () => {
      const { dispatch } = await seedDispatchChain()
      await app.request("/service-incidents", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, incidentType: "delay" }),
      })
      await app.request("/service-incidents", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, incidentType: "complaint" }),
      })
      const res = await app.request(`/service-incidents?dispatchId=${dispatch.id}`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.total).toBe(2)
    })

    it("filters by severity", async () => {
      const { dispatch } = await seedDispatchChain()
      await app.request("/service-incidents", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, incidentType: "note", severity: "info" }),
      })
      await app.request("/service-incidents", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, incidentType: "breakdown", severity: "critical" }),
      })
      const res = await app.request(
        `/service-incidents?dispatchId=${dispatch.id}&severity=critical`,
        { method: "GET" },
      )
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].severity).toBe("critical")
    })

    it("filters by resolutionStatus", async () => {
      const { dispatch } = await seedDispatchChain()
      await app.request("/service-incidents", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, incidentType: "delay", resolutionStatus: "open" }),
      })
      await app.request("/service-incidents", {
        method: "POST",
        ...json({
          dispatchId: dispatch.id,
          incidentType: "complaint",
          resolutionStatus: "resolved",
        }),
      })
      const res = await app.request(
        `/service-incidents?dispatchId=${dispatch.id}&resolutionStatus=resolved`,
        { method: "GET" },
      )
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].resolutionStatus).toBe("resolved")
    })
  })

  // ─── Dispatch Checkpoints ──────────────────────────────────

  describe("Dispatch Checkpoints", () => {
    it("creates a checkpoint with defaults", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request("/dispatch-checkpoints", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, checkpointType: "departure" }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.id).toMatch(/^gdcp_/)
      expect(data.sequence).toBe(0)
      expect(data.status).toBe("pending")
    })

    it("creates with all fields", async () => {
      const { dispatch } = await seedDispatchChain()
      const res = await app.request("/dispatch-checkpoints", {
        method: "POST",
        ...json({
          dispatchId: dispatch.id,
          sequence: 1,
          checkpointType: "arrival",
          status: "reached",
          plannedAt: "2025-06-15T09:00:00Z",
          actualAt: "2025-06-15T09:05:00Z",
          notes: "Arrived slightly late",
        }),
      })
      expect(res.status).toBe(201)
      const { data } = await res.json()
      expect(data.sequence).toBe(1)
      expect(data.checkpointType).toBe("arrival")
      expect(data.status).toBe("reached")
      expect(data.notes).toBe("Arrived slightly late")
    })

    it("gets a checkpoint by id", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/dispatch-checkpoints", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, checkpointType: "departure" }),
      })
      const { data: cp } = await createRes.json()

      const res = await app.request(`/dispatch-checkpoints/${cp.id}`, { method: "GET" })
      expect(res.status).toBe(200)
    })

    it("returns 404 for non-existent checkpoint", async () => {
      const res = await app.request("/dispatch-checkpoints/gdcp_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("updates a checkpoint", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/dispatch-checkpoints", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, checkpointType: "departure" }),
      })
      const { data: cp } = await createRes.json()

      const res = await app.request(`/dispatch-checkpoints/${cp.id}`, {
        method: "PATCH",
        ...json({ status: "reached", actualAt: "2025-06-15T08:00:00Z" }),
      })
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.status).toBe("reached")
    })

    it("deletes a checkpoint", async () => {
      const { dispatch } = await seedDispatchChain()
      const createRes = await app.request("/dispatch-checkpoints", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, checkpointType: "departure" }),
      })
      const { data: cp } = await createRes.json()

      const res = await app.request(`/dispatch-checkpoints/${cp.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })
  })

  describe("Dispatch Checkpoints list & filters", () => {
    it("lists filtered by dispatchId", async () => {
      const { dispatch } = await seedDispatchChain()
      await app.request("/dispatch-checkpoints", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, checkpointType: "departure", sequence: 0 }),
      })
      await app.request("/dispatch-checkpoints", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, checkpointType: "arrival", sequence: 1 }),
      })
      const res = await app.request(`/dispatch-checkpoints?dispatchId=${dispatch.id}`, {
        method: "GET",
      })
      const body = await res.json()
      expect(body.total).toBe(2)
    })

    it("filters by status", async () => {
      const { dispatch } = await seedDispatchChain()
      await app.request("/dispatch-checkpoints", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, checkpointType: "departure", status: "pending" }),
      })
      await app.request("/dispatch-checkpoints", {
        method: "POST",
        ...json({ dispatchId: dispatch.id, checkpointType: "arrival", status: "reached" }),
      })
      const res = await app.request(
        `/dispatch-checkpoints?dispatchId=${dispatch.id}&status=reached`,
        { method: "GET" },
      )
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].status).toBe("reached")
    })
  })
})
