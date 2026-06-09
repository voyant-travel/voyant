import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class QuoteVersionConflictError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "QuoteVersionConflictError"
    }
  }
  return {
    QuoteVersionConflictError,
    acceptQuoteVersion: vi.fn(),
    declineQuoteVersion: vi.fn(),
    expireQuoteVersionIfPastValidUntil: vi.fn(),
    getOperatorSettings: vi.fn(),
    getQuoteVersionProposal: vi.fn(),
    getTrip: vi.fn(),
    getTripSnapshotById: vi.fn(),
    markQuoteVersionViewed: vi.fn(),
    reserveTrip: vi.fn(),
    sendQuoteVersion: vi.fn(),
    startCheckout: vi.fn(),
  }
})

vi.mock("@voyantjs/crm", async () => {
  const { z } = await import("zod")
  return {
    QuoteVersionConflictError: mocks.QuoteVersionConflictError,
    sendQuoteVersionSchema: z.object({
      validUntil: z.string().date().nullable().optional(),
    }),
    crmService: {
      acceptQuoteVersion: mocks.acceptQuoteVersion,
      declineQuoteVersion: mocks.declineQuoteVersion,
      expireQuoteVersionIfPastValidUntil: mocks.expireQuoteVersionIfPastValidUntil,
      getQuoteVersionProposal: mocks.getQuoteVersionProposal,
      markQuoteVersionViewed: mocks.markQuoteVersionViewed,
      sendQuoteVersion: mocks.sendQuoteVersion,
    },
  }
})

vi.mock("@voyantjs/travel-composer", () => {
  class TravelComposerInvariantError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "TravelComposerInvariantError"
    }
  }
  return {
    TravelComposerInvariantError,
    travelComposerService: {
      getTrip: mocks.getTrip,
      getTripSnapshotById: mocks.getTripSnapshotById,
      reserveTrip: mocks.reserveTrip,
      startCheckout: mocks.startCheckout,
    },
  }
})

vi.mock("./operator-runtime-adapter", () => ({
  operatorPostgresDb: (db: unknown) => db,
}))

vi.mock("./settings", () => ({
  getOperatorSettings: mocks.getOperatorSettings,
  toPublicOperatorSettings: (settings: unknown) => settings,
}))

vi.mock("./travel-composer-runtime", () => ({
  createReserveTripDeps: () => ({ reserve: "deps" }),
  createStartCheckoutDeps: () => ({ checkout: "deps" }),
}))

import { buildQuoteVersionProposalUrl, mountOperatorProposalRoutes } from "./proposal-routes"

const fakeTx = { execute: vi.fn(), name: "tx" }
const fakeDb = {
  name: "db",
  transaction: vi.fn(async (callback: (tx: typeof fakeTx) => Promise<unknown>) => callback(fakeTx)),
}
const quoteVersion = {
  id: "qver_123",
  quoteId: "quot_123",
  label: "Internal working proposal",
  status: "sent",
  tripSnapshotId: "trsn_123",
  validUntil: "2099-01-01",
  currency: "EUR",
  subtotalAmountCents: 10000,
  taxAmountCents: 900,
  totalAmountCents: 10900,
  notes: "Internal proposal notes",
  sentAt: "2026-06-09T10:00:00.000Z",
  viewedAt: null,
  decidedAt: null,
}

const proposal = {
  quote: {
    id: "quot_123",
    ownerId: "usr_internal_owner",
    title: "Romania private tour",
    pipelineId: "pipe_internal",
    stageId: "stg_internal",
    status: "open",
    valueAmountCents: 250000,
    valueCurrency: "EUR",
    expectedCloseDate: "2026-07-01",
    source: "inquiry",
    sourceRef: "inq_123",
    lostReason: "Internal loss reason",
  },
  quoteVersion,
  lines: [
    {
      id: "qtln_123",
      quoteVersionId: "qver_123",
      productId: "qprd_internal",
      supplierServiceId: "srv_internal",
      description: "Airport transfer",
      quantity: 1,
      unitPriceAmountCents: 10000,
      totalAmountCents: 10900,
      currency: "EUR",
    },
  ],
}

const frozenEnvelope = {
  id: "trip_123",
  status: "priced",
  title: "Romania private tour",
  description: null,
  travelerParty: {},
  constraints: {},
  aggregateCurrency: "EUR",
  aggregateSubtotalAmountCents: 10000,
  aggregateTaxAmountCents: 900,
  aggregateTotalAmountCents: 10900,
  updatedAt: "2026-06-09T09:00:00.000Z",
}

const frozenComponent = {
  id: "trcp_123",
  envelopeId: "trip_123",
  sequence: 0,
  kind: "manual_service",
  status: "priced",
  title: "Airport transfer",
  description: null,
  entityModule: "products",
  entityId: "prod_123",
  sourceKind: "manual",
  pricingSnapshot: {
    currency: "EUR",
    subtotalAmountCents: 10000,
    taxAmountCents: 900,
    totalAmountCents: 10900,
  },
  warningCodes: [],
  metadata: { manualService: { name: "Airport transfer" } },
  updatedAt: "2026-06-09T09:00:00.000Z",
}

const tripSnapshot = {
  id: "trsn_123",
  envelopeId: "trip_123",
  currency: "EUR",
  subtotalAmountCents: 10000,
  taxAmountCents: 900,
  totalAmountCents: 10900,
  frozenEnvelope,
  frozenComponents: [frozenComponent],
  proposal: {
    envelopeId: "trip_123",
    title: "Romania private tour",
    description: null,
    currency: "EUR",
    subtotalAmountCents: 10000,
    taxAmountCents: 900,
    totalAmountCents: 10900,
    componentCount: 1,
    pricedComponentCount: 1,
    warnings: [],
    frozenAt: "2026-06-09T10:00:00.000Z",
    lines: [
      {
        componentId: "trcp_123",
        sequence: 0,
        kind: "manual_service",
        status: "priced",
        title: "Airport transfer",
        description: "Airport transfer",
        entityModule: "products",
        entityId: "prod_123",
        sourceKind: "manual",
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

const liveTrip = {
  envelope: frozenEnvelope,
  components: [frozenComponent],
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
    await next()
  })
  mountOperatorProposalRoutes(app as never)
  return app
}

describe("operator proposal routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.expireQuoteVersionIfPastValidUntil.mockResolvedValue(null)
    mocks.getOperatorSettings.mockResolvedValue({
      name: "Voyant Travel",
      legalName: "Voyant Travel SRL",
      address: "1 Main St",
      phone: "",
      email: "hello@example.com",
      website: "",
      license: "",
      licenseAuthority: "",
    })
  })

  it("builds root-relative and absolute proposal URLs", () => {
    expect(buildQuoteVersionProposalUrl("qver_123")).toBe("/proposal/qver_123")
    expect(
      buildQuoteVersionProposalUrl("qver 123", { baseUrl: "https://travel.example.com/" }),
    ).toBe("https://travel.example.com/proposal/qver%20123")
  })

  it("sends a quote version and returns the public proposal path", async () => {
    const app = makeApp()
    mocks.sendQuoteVersion.mockResolvedValue(quoteVersion)

    const response = await app.request("/v1/admin/quote-versions/qver_123/send", {
      method: "POST",
      ...json({ validUntil: "2099-01-01" }),
    })

    expect(response.status).toBe(200)
    expect(mocks.sendQuoteVersion).toHaveBeenCalledWith(fakeDb, "qver_123", {
      validUntil: "2099-01-01",
    })
    await expect(response.json()).resolves.toMatchObject({
      data: {
        quoteVersion: { id: "qver_123", status: "sent" },
        proposalUrl: "/proposal/qver_123",
      },
    })
  })

  it("returns and tracks a public sent proposal", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.markQuoteVersionViewed.mockResolvedValue({
      ...quoteVersion,
      viewedAt: "2026-06-09T10:05:00.000Z",
    })

    const response = await app.request("/v1/public/proposals/qver_123", { method: "GET" })

    expect(response.status).toBe(200)
    expect(mocks.expireQuoteVersionIfPastValidUntil).toHaveBeenCalledWith(fakeDb, "qver_123")
    expect(mocks.markQuoteVersionViewed).toHaveBeenCalledWith(fakeDb, "qver_123")
    const body = (await response.json()) as {
      data: Record<string, unknown> & { lines: Array<Record<string, unknown>> }
    }
    expect(body).toMatchObject({
      data: {
        title: "Romania private tour",
        status: "sent",
        currency: "EUR",
        subtotalAmountCents: 10000,
        taxAmountCents: 900,
        totalAmountCents: 10900,
        validUntil: "2099-01-01",
        lines: [
          {
            description: "Airport transfer",
            quantity: 1,
            unitPriceAmountCents: 10000,
            totalAmountCents: 10900,
            currency: "EUR",
          },
        ],
        operator: { name: "Voyant Travel" },
        proposalUrl: "/proposal/qver_123",
      },
    })
    expect(body.data.quote).toBeUndefined()
    expect(body.data.quoteVersion).toBeUndefined()
    expect(body.data.label).toBeUndefined()
    expect(body.data.ownerId).toBeUndefined()
    expect(body.data.pipelineId).toBeUndefined()
    expect(body.data.stageId).toBeUndefined()
    expect(body.data.valueAmountCents).toBeUndefined()
    expect(body.data.valueCurrency).toBeUndefined()
    expect(body.data.expectedCloseDate).toBeUndefined()
    expect(body.data.source).toBeUndefined()
    expect(body.data.sourceRef).toBeUndefined()
    expect(body.data.lostReason).toBeUndefined()
    expect(body.data.tripSnapshotId).toBeUndefined()
    expect(body.data.notes).toBeUndefined()
    expect(body.data.sentAt).toBeUndefined()
    expect(body.data.viewedAt).toBeUndefined()
    expect(body.data.decidedAt).toBeUndefined()
    expect(body.data.lines[0].id).toBeUndefined()
    expect(body.data.lines[0].quoteVersionId).toBeUndefined()
    expect(body.data.lines[0].productId).toBeUndefined()
    expect(body.data.lines[0].supplierServiceId).toBeUndefined()
  })

  it("hides draft proposals from public reads", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue({
      ...proposal,
      quoteVersion: { ...quoteVersion, status: "draft" },
    })

    const response = await app.request("/v1/public/proposals/qver_123", { method: "GET" })

    expect(response.status).toBe(404)
    expect(mocks.markQuoteVersionViewed).not.toHaveBeenCalled()
  })

  it("declines a sent proposal through the public link", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.declineQuoteVersion.mockResolvedValue({
      ...quoteVersion,
      status: "declined",
      decidedAt: "2026-06-09T10:10:00.000Z",
    })

    const response = await app.request("/v1/public/proposals/qver_123/decline", {
      method: "POST",
      ...json({}),
    })

    expect(response.status).toBe(200)
    expect(mocks.declineQuoteVersion).toHaveBeenCalledWith(fakeDb, "qver_123")
    const body = await response.json()
    expect(body).toEqual({ data: { status: "declined" } })
  })

  it("accepts a sent proposal by verifying the snapshot, reserving, accepting, and starting checkout", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.getTripSnapshotById.mockResolvedValue(tripSnapshot)
    mocks.getTrip.mockResolvedValue(liveTrip)
    mocks.reserveTrip.mockResolvedValue({
      envelope: { id: "trip_123", aggregateCurrency: "EUR", aggregateTotalAmountCents: 10900 },
      components: [],
      reserved: [{ componentId: "trcp_123", status: "held" }],
      failures: [],
      compensations: [],
      warnings: [],
    })
    mocks.acceptQuoteVersion.mockResolvedValue({
      quote: { ...proposal.quote, status: "won", acceptedVersionId: "qver_123" },
      quoteVersion: { ...quoteVersion, status: "accepted" },
      closedQuoteVersions: [],
    })
    mocks.startCheckout.mockResolvedValue({
      envelope: { id: "trip_123" },
      components: [],
      target: {
        envelopeId: "trip_123",
        status: "checkout_started",
        currency: "EUR",
        totalAmountCents: 10900,
        paymentSessionId: "pays_123",
        checkoutUrl: "https://travel.example.com/pay/pays_123",
        holdExpiresAt: null,
      },
      componentCheckouts: [],
      failures: [],
      warnings: [],
    })

    const response = await app.request("/v1/public/proposals/qver_123/accept", {
      method: "POST",
      ...json({ intent: "card", idempotencyKey: "accept-1" }),
    })

    expect(response.status).toBe(200)
    expect(fakeDb.transaction).toHaveBeenCalledOnce()
    expect(fakeTx.execute).toHaveBeenCalledOnce()
    expect(mocks.getTripSnapshotById).toHaveBeenCalledWith(fakeTx, "trsn_123")
    expect(mocks.getTrip).toHaveBeenCalledWith(fakeTx, "trip_123")
    expect(mocks.reserveTrip).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({
        envelopeId: "trip_123",
        idempotencyKey: "proposal-accept-reserve:qver_123:accept-1",
      }),
      { reserve: "deps" },
    )
    expect(mocks.acceptQuoteVersion).toHaveBeenCalledWith(fakeTx, "qver_123", {})
    expect(mocks.startCheckout).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({
        envelopeId: "trip_123",
        intent: "card",
        idempotencyKey: "proposal-accept-checkout:qver_123:card:accept-1",
      }),
      { checkout: "deps" },
    )
    expect(mocks.reserveTrip.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.acceptQuoteVersion.mock.invocationCallOrder[0],
    )
    expect(fakeTx.execute.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reserveTrip.mock.invocationCallOrder[0],
    )
    const body = await response.json()
    expect(body).toEqual({
      data: {
        status: "accepted",
        checkoutUrl: "https://travel.example.com/pay/pays_123",
        paymentSessionId: "pays_123",
        currency: "EUR",
        totalAmountCents: 10900,
        warnings: [],
      },
    })
  })

  it("rejects accepting when the CRM proposal copy does not match the frozen snapshot", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.getTripSnapshotById.mockResolvedValue({
      ...tripSnapshot,
      proposal: { ...tripSnapshot.proposal, totalAmountCents: 11000 },
    })

    const response = await app.request("/v1/public/proposals/qver_123/accept", {
      method: "POST",
      ...json({}),
    })

    expect(response.status).toBe(409)
    expect(mocks.reserveTrip).not.toHaveBeenCalled()
    expect(mocks.acceptQuoteVersion).not.toHaveBeenCalled()
  })

  it("rejects accepting when the live trip has changed after the frozen snapshot", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.getTripSnapshotById.mockResolvedValue(tripSnapshot)
    mocks.getTrip.mockResolvedValue({
      ...liveTrip,
      components: [
        {
          ...frozenComponent,
          title: "Edited transfer",
        },
      ],
    })

    const response = await app.request("/v1/public/proposals/qver_123/accept", {
      method: "POST",
      ...json({}),
    })

    expect(response.status).toBe(409)
    const body = (await response.json()) as { error?: string }
    expect(body.error).toContain("changed")
    expect(mocks.reserveTrip).not.toHaveBeenCalled()
    expect(mocks.acceptQuoteVersion).not.toHaveBeenCalled()
  })

  it("rechecks a sent proposal under the quote accept lock before reserving", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValueOnce(proposal).mockResolvedValueOnce({
      ...proposal,
      quoteVersion: { ...quoteVersion, status: "declined" },
    })

    const response = await app.request("/v1/public/proposals/qver_123/accept", {
      method: "POST",
      ...json({}),
    })

    expect(response.status).toBe(409)
    expect(fakeDb.transaction).toHaveBeenCalledOnce()
    expect(fakeTx.execute).toHaveBeenCalledOnce()
    expect(mocks.reserveTrip).not.toHaveBeenCalled()
    expect(mocks.acceptQuoteVersion).not.toHaveBeenCalled()
    const body = (await response.json()) as { error?: string }
    expect(body.error).toContain("can no longer be accepted")
  })

  it("replays checkout for an already accepted proposal without reserving again", async () => {
    const app = makeApp()
    const acceptedProposal = {
      ...proposal,
      quote: { ...proposal.quote, status: "won", acceptedVersionId: "qver_123" },
      quoteVersion: { ...quoteVersion, status: "accepted", decidedAt: "2026-06-09T10:05:00.000Z" },
    }
    mocks.getQuoteVersionProposal
      .mockResolvedValueOnce(acceptedProposal)
      .mockResolvedValueOnce(acceptedProposal)
    mocks.getTripSnapshotById.mockResolvedValue(tripSnapshot)
    mocks.acceptQuoteVersion.mockResolvedValue({
      quote: acceptedProposal.quote,
      quoteVersion: acceptedProposal.quoteVersion,
      closedQuoteVersions: [],
    })
    mocks.startCheckout.mockResolvedValue({
      target: {
        currency: "EUR",
        totalAmountCents: 10900,
        paymentSessionId: "pays_123",
        checkoutUrl: "https://travel.example.com/pay/pays_123",
      },
      failures: [],
      warnings: [],
    })

    const response = await app.request("/v1/public/proposals/qver_123/accept", {
      method: "POST",
      ...json({ intent: "card", idempotencyKey: "accept-1" }),
    })

    expect(response.status).toBe(200)
    expect(mocks.getTripSnapshotById).toHaveBeenCalledWith(fakeTx, "trsn_123")
    expect(mocks.getTrip).not.toHaveBeenCalled()
    expect(mocks.reserveTrip).not.toHaveBeenCalled()
    expect(mocks.acceptQuoteVersion).toHaveBeenCalledWith(fakeTx, "qver_123", {})
    expect(mocks.startCheckout).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({
        idempotencyKey: "proposal-accept-checkout:qver_123:card:accept-1",
      }),
      { checkout: "deps" },
    )
    const body = (await response.json()) as { data?: Record<string, unknown> }
    expect(body.data).toMatchObject({
      status: "accepted",
      checkoutUrl: "https://travel.example.com/pay/pays_123",
    })
  })

  it("returns safe reservation failure details without accepting the proposal", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.getTripSnapshotById.mockResolvedValue(tripSnapshot)
    mocks.getTrip.mockResolvedValue(liveTrip)
    mocks.reserveTrip.mockResolvedValue({
      envelope: { id: "trip_123" },
      components: [],
      reserved: [],
      failures: [{ componentId: "trcp_123", code: "price_changed", reason: "price_changed" }],
      compensations: [],
      warnings: ["price_changed"],
    })

    const response = await app.request("/v1/public/proposals/qver_123/accept", {
      method: "POST",
      ...json({}),
    })

    expect(response.status).toBe(409)
    expect(mocks.acceptQuoteVersion).not.toHaveBeenCalled()
    const body = await response.json()
    expect(body).toEqual({
      error: "Proposal could not be reserved",
      failures: [{ code: "price_changed", reason: "price_changed" }],
    })
  })
})
