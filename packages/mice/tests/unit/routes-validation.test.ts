import { handleApiError } from "@voyant-travel/hono"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { createMiceAdminRoutes, miceAdminRoutes } from "../../src/routes.js"
import { MICE_RFP_AWARDED_EVENT } from "../../src/service-rfp.js"

function delegateRow(patch: Record<string, unknown> = {}) {
  return {
    id: "mice_program_delegates_1",
    programId: "mice_programs_1",
    personId: null,
    bookingId: null,
    role: "attendee",
    status: "invited",
    arrivalAt: null,
    departureAt: null,
    notes: null,
    metadata: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...patch,
  }
}

type FakeProgramDbOptions = {
  selectRows?: unknown[][]
  insertRows?: unknown[]
  updateRows?: unknown[]
  insertedValues?: unknown[]
  updatedValues?: unknown[]
}

function fakeProgramDb(options: FakeProgramDbOptions | unknown[][] = {}) {
  const {
    selectRows = [],
    insertRows = [],
    updateRows = [],
    insertedValues,
    updatedValues,
  } = Array.isArray(options) ? { selectRows: options } : options

  return {
    select: vi.fn(() => {
      const rows = selectRows.shift() ?? []
      const builder = {
        from: vi.fn(() => builder),
        where: vi.fn(() => builder),
        limit: vi.fn(() => Promise.resolve(rows)),
      }
      return builder
    }),
    insert: vi.fn(() => {
      const builder = {
        values: vi.fn((values: unknown) => {
          insertedValues?.push(values)
          return builder
        }),
        returning: vi.fn(() => Promise.resolve(insertRows)),
      }
      return builder
    }),
    update: vi.fn(() => {
      const builder = {
        set: vi.fn((values: unknown) => {
          updatedValues?.push(values)
          return builder
        }),
        where: vi.fn(() => builder),
        returning: vi.fn(() => Promise.resolve(updateRows)),
      }
      return builder
    }),
  }
}

function makeApp(
  db: unknown,
  routes: ReturnType<typeof createMiceAdminRoutes> = miceAdminRoutes,
  options: { eventBus?: unknown; userId?: string } = {},
) {
  const app = new Hono()
  app.onError((err, c) => handleApiError(err, c))
  app.use("*", async (c, next) => {
    c.set("db", db as never)
    if (options.eventBus) c.set("eventBus" as never, options.eventBus as never)
    if (options.userId) c.set("userId" as never, options.userId as never)
    await next()
  })
  app.route("/", routes)
  return app
}

function fakeAwardRfpDb() {
  const rfp = {
    id: "mice_rfps_1",
    programId: "mice_programs_1",
    title: "Venue RFP",
    requirements: null,
    status: "issued",
    issuedAt: null,
    dueAt: null,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  }
  const winner = {
    id: "mice_bids_winner",
    rfpId: rfp.id,
    supplierId: "suppliers_1",
    status: "submitted",
    totalCents: 90_000,
    currency: "EUR",
    proposalDoc: null,
    validUntil: null,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  }
  const acceptedBid = {
    ...winner,
    status: "accepted",
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  }
  const awardedRfp = {
    ...rfp,
    status: "awarded",
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  }
  const selectRows = [[rfp], [winner]]
  const updateReturningRows = [[acceptedBid], [awardedRfp]]
  let updateCalls = 0

  const tx = {
    select: vi.fn(() => {
      const rows = selectRows.shift() ?? []
      const builder = {
        from: vi.fn(() => builder),
        where: vi.fn(() => builder),
        for: vi.fn(() => builder),
        limit: vi.fn(() => Promise.resolve(rows)),
      }
      return builder
    }),
    update: vi.fn(() => {
      const updateCall = updateCalls
      updateCalls += 1
      const builder = {
        set: vi.fn(() => builder),
        where: vi.fn(() => (updateCall === 0 ? Promise.resolve([]) : builder)),
        returning: vi.fn(() => Promise.resolve(updateReturningRows.shift() ?? [])),
      }
      return builder
    }),
  }

  return {
    db: {
      transaction: vi.fn((callback: (transactionDb: typeof tx) => unknown) => callback(tx)),
    },
    rfp,
    winner,
    acceptedBid,
    awardedRfp,
  }
}

describe("mice program route validation", () => {
  it("rejects program create when endDate is before startDate", async () => {
    const db = fakeProgramDb()
    const response = await makeApp(db).request("/programs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Acme Kickoff",
        type: "meeting",
        startDate: "2026-12-10",
        endDate: "2026-12-01",
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_request",
      details: {
        issues: [
          expect.objectContaining({
            path: ["endDate"],
            message: "endDate must be on or after startDate",
          }),
        ],
      },
    })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("rejects program patch when the stored date range would become reversed", async () => {
    const db = fakeProgramDb([
      [
        {
          id: "mice_programs_1",
          name: "Acme Kickoff",
          startDate: "2026-12-10",
          endDate: "2026-12-20",
        },
      ],
    ])

    const response = await makeApp(db).request("/programs/mice_programs_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endDate: "2026-12-01" }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_request",
      details: {
        issues: [
          expect.objectContaining({
            path: ["endDate"],
            message: "endDate must be on or after startDate",
          }),
        ],
      },
    })
    expect(db.update).not.toHaveBeenCalled()
  })

  it("rejects delegate create when personId does not resolve", async () => {
    const insertedValues: unknown[] = []
    const db = fakeProgramDb({ selectRows: [[{ id: "mice_programs_1" }]], insertedValues })
    const resolveDelegatePersonById = vi.fn(async () => false)
    const response = await makeApp(
      db,
      createMiceAdminRoutes({ resolveDelegatePersonById }),
    ).request("/delegates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        programId: "mice_programs_1",
        personId: "pers_missing",
        role: "attendee",
      }),
    })

    expect(insertedValues).toEqual([])
    expect(resolveDelegatePersonById).toHaveBeenCalledWith(db, "pers_missing")
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_request",
      details: {
        fields: {
          fieldErrors: { personId: ["Person not found"] },
          formErrors: [],
        },
      },
    })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("allows delegate create without a personId", async () => {
    const insertedValues: unknown[] = []
    const db = fakeProgramDb({
      selectRows: [[{ id: "mice_programs_1" }]],
      insertRows: [delegateRow()],
      insertedValues,
    })
    const response = await makeApp(
      db,
      createMiceAdminRoutes({ resolveDelegatePersonById: async () => false }),
    ).request("/delegates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        programId: "mice_programs_1",
        role: "attendee",
      }),
    })

    expect(response.status).toBe(201)
    expect(insertedValues).toEqual([
      { programId: "mice_programs_1", role: "attendee", status: "invited" },
    ])
  })

  it("rejects delegate patch when personId does not resolve", async () => {
    const db = fakeProgramDb()
    const resolveDelegatePersonById = vi.fn(async () => false)
    const response = await makeApp(
      db,
      createMiceAdminRoutes({ resolveDelegatePersonById }),
    ).request("/delegates/mice_program_delegates_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ personId: "pers_missing" }),
    })

    expect(resolveDelegatePersonById).toHaveBeenCalledWith(db, "pers_missing")
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_request",
      details: {
        fields: {
          fieldErrors: { personId: ["Person not found"] },
          formErrors: [],
        },
      },
    })
    expect(db.update).not.toHaveBeenCalled()
  })

  it("allows delegate patch to clear personId", async () => {
    const updatedValues: unknown[] = []
    const db = fakeProgramDb({
      updateRows: [delegateRow({ personId: null })],
      updatedValues,
    })
    const response = await makeApp(
      db,
      createMiceAdminRoutes({ resolveDelegatePersonById: async () => false }),
    ).request("/delegates/mice_program_delegates_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ personId: null }),
    })

    expect(response.status).toBe(200)
    expect(updatedValues).toEqual([expect.objectContaining({ personId: null })])
  })

  it("emits a domain event when awarding an RFP", async () => {
    const { db, rfp, winner } = fakeAwardRfpDb()
    const eventBus = { emit: vi.fn(async () => undefined) }

    const response = await makeApp(db, miceAdminRoutes, {
      eventBus,
      userId: "user_1",
    }).request(`/rfps/${rfp.id}/award`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bidId: winner.id }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        rfp: { id: rfp.id, status: "awarded" },
        bid: { id: winner.id, status: "accepted" },
      },
    })
    expect(eventBus.emit).toHaveBeenCalledWith(
      MICE_RFP_AWARDED_EVENT,
      expect.objectContaining({
        rfpId: rfp.id,
        programId: rfp.programId,
        bidId: winner.id,
        supplierId: winner.supplierId,
        actorId: "user_1",
        awardedAt: expect.any(String),
      }),
      { category: "domain", source: "service" },
    )
  })
})
