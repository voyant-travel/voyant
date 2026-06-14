import { Hono } from "hono"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { bookingRoutes } from "../../src/routes.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

let bookingSeq = 0
function nextBookingNumber() {
  bookingSeq++
  return `BK-GRPT-${String(bookingSeq).padStart(6, "0")}`
}

describe.skipIf(!DB_AVAILABLE)("Booking groups routes", () => {
  let app: Hono
  let db: ReturnType<typeof import("@voyant-travel/db/test-utils").createTestDb>

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db", db)
      c.set("userId", "user_test")
      await next()
    })
    app.route("/", bookingRoutes)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  async function seedBooking() {
    const res = await app.request("/", {
      method: "POST",
      ...json({ bookingNumber: nextBookingNumber(), sellCurrency: "USD" }),
    })
    return (await res.json()).data
  }

  async function createGroup(overrides: Record<string, unknown> = {}) {
    const res = await app.request("/groups", {
      method: "POST",
      ...json({
        kind: "shared_room",
        label: "Shared room test",
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    return (await res.json()).data
  }

  async function addMember(groupId: string, bookingId: string, role = "shared") {
    const res = await app.request(`/groups/${groupId}/members`, {
      method: "POST",
      ...json({ bookingId, role }),
    })
    return { status: res.status, body: await res.json() }
  }

  async function cancelBooking(bookingId: string) {
    const res = await app.request(`/${bookingId}/cancel`, {
      method: "POST",
      ...json({}),
    })
    return { status: res.status, body: await res.json() }
  }

  async function getGroup(groupId: string) {
    const res = await app.request(`/groups/${groupId}`)
    return { status: res.status, body: await res.json() }
  }

  async function getGroupForBooking(bookingId: string) {
    const res = await app.request(`/${bookingId}/group`)
    expect(res.status).toBe(200)
    return (await res.json()).data
  }

  it("creates, reads, updates, and deletes a group", async () => {
    const group = await createGroup({ label: "Room 101" })
    expect(group.label).toBe("Room 101")
    expect(group.kind).toBe("shared_room")

    const get = await getGroup(group.id)
    expect(get.status).toBe(200)
    expect(get.body.data.label).toBe("Room 101")
    expect(get.body.data.members).toEqual([])

    const patched = await app.request(`/groups/${group.id}`, {
      method: "PATCH",
      ...json({ label: "Room 101 — renamed" }),
    })
    expect(patched.status).toBe(200)
    expect((await patched.json()).data.label).toBe("Room 101 — renamed")

    const del = await app.request(`/groups/${group.id}`, { method: "DELETE" })
    expect(del.status).toBe(200)

    const afterDelete = await app.request(`/groups/${group.id}`)
    expect(afterDelete.status).toBe(404)
  })

  it("adds and removes members", async () => {
    const booking = await seedBooking()
    const group = await createGroup()

    const added = await addMember(group.id, booking.id, "primary")
    expect(added.status).toBe(201)
    expect(added.body.data.role).toBe("primary")
    expect(added.body.data.bookingId).toBe(booking.id)

    const detail = await getGroup(group.id)
    expect(detail.body.data.members).toHaveLength(1)

    const removed = await app.request(`/groups/${group.id}/members/${booking.id}`, {
      method: "DELETE",
    })
    expect(removed.status).toBe(200)

    const afterRemove = await getGroup(group.id)
    expect(afterRemove.body.data.members).toHaveLength(0)
  })

  it("enforces one-group-per-booking via 409 on duplicate add", async () => {
    const booking = await seedBooking()
    const group1 = await createGroup()
    const group2 = await createGroup()

    const first = await addMember(group1.id, booking.id)
    expect(first.status).toBe(201)

    const second = await addMember(group2.id, booking.id)
    expect(second.status).toBe(409)
    expect(second.body.currentGroupId).toBe(group1.id)
  })

  it("returns the group via GET /:bookingId/group", async () => {
    const booking = await seedBooking()
    const group = await createGroup({ label: "For booking lookup" })
    await addMember(group.id, booking.id, "primary")

    const result = await getGroupForBooking(booking.id)
    expect(result).not.toBeNull()
    expect(result.id).toBe(group.id)
    expect(result.membership.role).toBe("primary")
  })

  it("returns null for a booking that isn't in any group", async () => {
    const booking = await seedBooking()
    const result = await getGroupForBooking(booking.id)
    expect(result).toBeNull()
  })

  it("cancellation cleanup: 3-member group keeps group with 2 active members", async () => {
    const [b1, b2, b3] = await Promise.all([seedBooking(), seedBooking(), seedBooking()])
    const group = await createGroup()
    await addMember(group.id, b1.id, "primary")
    await addMember(group.id, b2.id)
    await addMember(group.id, b3.id)

    // Cancel the third — 2 active should remain, group should persist.
    const cancel = await cancelBooking(b3.id)
    expect(cancel.status).toBe(200)

    const detail = await getGroup(group.id)
    expect(detail.status).toBe(200)
    expect(detail.body.data.members).toHaveLength(2)
  })

  it("cancellation cleanup: 2-member group dissolves when one is cancelled", async () => {
    const [b1, b2] = await Promise.all([seedBooking(), seedBooking()])
    const group = await createGroup()
    await addMember(group.id, b1.id, "primary")
    await addMember(group.id, b2.id)

    const cancel = await cancelBooking(b2.id)
    expect(cancel.status).toBe(200)

    // Group should be dissolved (deleted).
    const detail = await getGroup(group.id)
    expect(detail.status).toBe(404)

    // The remaining booking should no longer belong to a group.
    const groupForB1 = await getGroupForBooking(b1.id)
    expect(groupForB1).toBeNull()
  })

  it("cancellation cleanup: 1-member group is deleted when its only member is cancelled", async () => {
    const booking = await seedBooking()
    const group = await createGroup()
    await addMember(group.id, booking.id, "primary")

    await cancelBooking(booking.id)

    const detail = await getGroup(group.id)
    expect(detail.status).toBe(404)
  })

  it("lists groups filtered by productId", async () => {
    const g1 = await createGroup({ productId: "prod_a" })
    const g2 = await createGroup({ productId: "prod_b" })
    await createGroup({ productId: "prod_a" })

    const filtered = await app.request("/groups?productId=prod_a")
    const body = await filtered.json()
    const ids = body.data.map((g: { id: string }) => g.id).sort()
    expect(ids).toContain(g1.id)
    expect(ids).not.toContain(g2.id)
    expect(body.data).toHaveLength(2)
  })

  it("returns travelers across all group members", async () => {
    const [b1, b2] = await Promise.all([seedBooking(), seedBooking()])
    const group = await createGroup()
    await addMember(group.id, b1.id, "primary")
    await addMember(group.id, b2.id)

    // Add a traveler to each booking.
    await app.request(`/${b1.id}/travelers`, {
      method: "POST",
      ...json({ firstName: "Alice", lastName: "Smith" }),
    })
    await app.request(`/${b2.id}/travelers`, {
      method: "POST",
      ...json({ firstName: "Bob", lastName: "Jones" }),
    })

    const travelersRes = await app.request(`/groups/${group.id}/travelers`)
    expect(travelersRes.status).toBe(200)
    const travelersBody = await travelersRes.json()
    const travelerNames = travelersBody.data.map((p: { firstName: string }) => p.firstName).sort()
    expect(travelerNames).toEqual(["Alice", "Bob"])
  })
})
