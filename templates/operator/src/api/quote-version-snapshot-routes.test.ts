import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class QuoteVersionConflictError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "QuoteVersionConflictError"
    }
  }
  class TravelComposerInvariantError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "TravelComposerInvariantError"
    }
  }
  return {
    QuoteVersionConflictError,
    TravelComposerInvariantError,
    applyTripSnapshotToQuoteVersion: vi.fn(),
    freezeTripSnapshot: vi.fn(),
    getQuoteVersionById: vi.fn(),
  }
})

vi.mock("@voyantjs/crm", () => ({
  QuoteVersionConflictError: mocks.QuoteVersionConflictError,
  crmService: {
    applyTripSnapshotToQuoteVersion: mocks.applyTripSnapshotToQuoteVersion,
    getQuoteVersionById: mocks.getQuoteVersionById,
  },
}))

vi.mock("@voyantjs/travel-composer", () => ({
  TravelComposerInvariantError: mocks.TravelComposerInvariantError,
  travelComposerService: {
    freezeTripSnapshot: mocks.freezeTripSnapshot,
  },
}))

vi.mock("./operator-runtime-adapter", () => ({
  operatorPostgresDb: (db: unknown) => db,
}))

import {
  mountOperatorQuoteVersionSnapshotRoutes,
  tripSnapshotToQuoteVersionApply,
} from "./quote-version-snapshot-routes"

const fakeDb = { name: "db" }

const snapshot = {
  id: "trsn_123",
  proposal: {
    currency: "EUR",
    subtotalAmountCents: 10000,
    taxAmountCents: 900,
    totalAmountCents: 10900,
    lines: [
      {
        componentId: "trcp_123",
        sequence: 0,
        kind: "catalog_booking",
        status: "priced",
        title: "Airport transfer",
        description: "Airport transfer",
        entityModule: "products",
        entityId: "prod_123",
        sourceKind: "owned",
        currency: "EUR",
        subtotalAmountCents: 10000,
        taxAmountCents: 900,
        totalAmountCents: 10900,
        priceExpiresAt: null,
        warnings: [],
      },
    ],
  },
}

function json(body: Record<string, unknown>) {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }
}

function makeApp() {
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("db" as never, fakeDb as never)
    c.set("userId" as never, "user_1" as never)
    await next()
  })
  mountOperatorQuoteVersionSnapshotRoutes(app as never)
  return app
}

describe("operator quote version snapshot routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("maps a stored trip snapshot proposal into a CRM apply payload", () => {
    expect(tripSnapshotToQuoteVersionApply(snapshot as never)).toEqual({
      tripSnapshotId: "trsn_123",
      currency: "EUR",
      subtotalAmountCents: 10000,
      taxAmountCents: 900,
      totalAmountCents: 10900,
      lines: [
        {
          componentId: "trcp_123",
          productId: "prod_123",
          supplierServiceId: null,
          description: "Airport transfer",
          quantity: 1,
          unitPriceAmountCents: 10000,
          totalAmountCents: 10900,
          currency: "EUR",
        },
      ],
    })
  })

  it("freezes and applies server-derived snapshot values to the quote version", async () => {
    const app = makeApp()
    mocks.getQuoteVersionById.mockResolvedValue({
      id: "qver_123",
      quoteId: "quot_123",
      status: "draft",
    })
    mocks.freezeTripSnapshot.mockResolvedValue(snapshot)
    mocks.applyTripSnapshotToQuoteVersion.mockResolvedValue({
      quoteVersion: {
        id: "qver_123",
        quoteId: "quot_123",
        status: "draft",
        tripSnapshotId: "trsn_123",
        currency: "EUR",
        subtotalAmountCents: 10000,
        taxAmountCents: 900,
        totalAmountCents: 10900,
      },
      lines: [],
    })

    const response = await app.request(
      "/v1/admin/travel-composer/trips/trip_123/quote-versions/qver_123/snapshot",
      {
        method: "POST",
        ...json({
          createdBy: "agent_1",
          totalAmountCents: 1,
          lines: [{ description: "client supplied line" }],
        }),
      },
    )

    expect(response.status).toBe(201)
    expect(mocks.freezeTripSnapshot).toHaveBeenCalledWith(fakeDb, {
      envelopeId: "trip_123",
      createdBy: "user_1",
    })
    expect(mocks.applyTripSnapshotToQuoteVersion).toHaveBeenCalledWith(fakeDb, "qver_123", {
      tripSnapshotId: "trsn_123",
      currency: "EUR",
      subtotalAmountCents: 10000,
      taxAmountCents: 900,
      totalAmountCents: 10900,
      lines: [
        {
          componentId: "trcp_123",
          productId: "prod_123",
          supplierServiceId: null,
          description: "Airport transfer",
          quantity: 1,
          unitPriceAmountCents: 10000,
          totalAmountCents: 10900,
          currency: "EUR",
        },
      ],
    })
    await expect(response.json()).resolves.toMatchObject({
      data: { snapshot: { id: "trsn_123" }, quoteVersion: { id: "qver_123" } },
    })
  })

  it("rejects non-draft quote versions before freezing a snapshot", async () => {
    const app = makeApp()
    mocks.getQuoteVersionById.mockResolvedValue({
      id: "qver_123",
      quoteId: "quot_123",
      status: "sent",
    })

    const response = await app.request(
      "/v1/admin/travel-composer/trips/trip_123/quote-versions/qver_123/snapshot",
      {
        method: "POST",
        ...json({}),
      },
    )

    expect(response.status).toBe(409)
    expect(mocks.freezeTripSnapshot).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("draft"),
    })
  })
})
