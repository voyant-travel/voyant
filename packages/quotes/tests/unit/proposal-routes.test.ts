// agent-quality: file-size exception -- owner: quotes; the proposal route suite covers one cohesive accept-under-lock contract and stays co-located until a dedicated split preserves behavior and tests.
import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class QuoteVersionConflictError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "QuoteVersionConflictError"
    }
  }
  class TripsInvariantError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "TripsInvariantError"
    }
  }
  return {
    QuoteVersionConflictError,
    TripsInvariantError,
    // quotes service
    acceptQuoteVersion: vi.fn(),
    applyTripSnapshotToQuoteVersion: vi.fn(),
    declineQuoteVersion: vi.fn(),
    expireQuoteVersionIfPastValidUntil: vi.fn(),
    freezeTripSnapshot: vi.fn(),
    getQuoteVersionById: vi.fn(),
    getQuoteVersionProposal: vi.fn(),
    listQuoteMedia: vi.fn(),
    markQuoteVersionViewed: vi.fn(),
    recordPublicProposalFeedback: vi.fn(),
    sendQuoteVersion: vi.fn(),
    // trips service
    getTrip: vi.fn(),
    getTripSnapshotById: vi.fn(),
    reserveTrip: vi.fn(),
    cancelComponents: vi.fn(),
    startCheckout: vi.fn(),
  }
})

vi.mock("../../src/service/index.js", () => ({
  QuoteVersionConflictError: mocks.QuoteVersionConflictError,
  quotesService: {
    acceptQuoteVersion: mocks.acceptQuoteVersion,
    applyTripSnapshotToQuoteVersion: mocks.applyTripSnapshotToQuoteVersion,
    declineQuoteVersion: mocks.declineQuoteVersion,
    expireQuoteVersionIfPastValidUntil: mocks.expireQuoteVersionIfPastValidUntil,
    getQuoteVersionById: mocks.getQuoteVersionById,
    getQuoteVersionProposal: mocks.getQuoteVersionProposal,
    listQuoteMedia: mocks.listQuoteMedia,
    markQuoteVersionViewed: mocks.markQuoteVersionViewed,
    sendQuoteVersion: mocks.sendQuoteVersion,
  },
}))

vi.mock("@voyant-travel/trips", () => ({
  TripsInvariantError: mocks.TripsInvariantError,
  tripsService: {
    freezeTripSnapshot: mocks.freezeTripSnapshot,
    getTrip: mocks.getTrip,
    getTripSnapshotById: mocks.getTripSnapshotById,
    reserveTrip: mocks.reserveTrip,
    cancelComponents: mocks.cancelComponents,
    startCheckout: mocks.startCheckout,
  },
}))

const proposalRoutes = await import("../../src/proposal-routes.js")

const fakeTx = { execute: vi.fn(), name: "tx" }
const fakeDb = {
  name: "db",
  transaction: vi.fn(async (callback: (tx: typeof fakeTx) => Promise<unknown>) => callback(fakeTx)),
}

const operatorProfile = { name: "Voyant Travel" }

const options = {
  resolveDb: () => fakeDb as never,
  resolvePublicProposalBaseUrl: () => null,
  reserveTripDeps: () => ({ reserve: "deps" }) as never,
  startCheckoutDeps: () => ({ checkout: "deps" }) as never,
  cancelTripComponentsDeps: () => ({ cancel: "deps" }) as never,
  resolveOperatorProfile: vi.fn(async () => operatorProfile as unknown),
  recordPublicProposalFeedback: mocks.recordPublicProposalFeedback,
}

const quoteVersion = {
  id: "qver_123",
  quoteId: "quot_123",
  status: "sent",
  tripSnapshotId: "trsn_123",
  validUntil: "2099-01-01",
  currency: "EUR",
  subtotalAmountCents: 10000,
  taxAmountCents: 900,
  totalAmountCents: 10900,
  viewedAt: null,
  decidedAt: null,
}

const proposal = {
  quote: { id: "quot_123", title: "Romania private tour", acceptedVersionId: null },
  quoteVersion,
  lines: [
    {
      id: "qtln_123",
      quoteVersionId: "qver_123",
      productId: "prod_123",
      supplierServiceId: null,
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
  aggregateCurrency: "EUR",
  aggregateSubtotalAmountCents: 10000,
  aggregateTaxAmountCents: 900,
  aggregateTotalAmountCents: 10900,
}

const frozenComponent = {
  id: "trcp_123",
  envelopeId: "trip_123",
  sequence: 0,
  kind: "manual_service",
  status: "priced",
  title: "Airport transfer",
  entityModule: "products",
  entityId: "prod_123",
  sourceKind: "manual",
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
    currency: "EUR",
    subtotalAmountCents: 10000,
    taxAmountCents: 900,
    totalAmountCents: 10900,
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
        warnings: [],
      },
    ],
  },
}

const liveTrip = { envelope: frozenEnvelope, components: [frozenComponent] }

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
  app.route(
    "/v1/admin/quote-versions",
    proposalRoutes.createQuoteProposalAdminRoutes(options as never) as never,
  )
  app.route(
    "/v1/public/proposals",
    proposalRoutes.createQuoteProposalPublicRoutes(options as never) as never,
  )
  app.route(
    "/v1/admin/trips",
    proposalRoutes.createQuoteVersionSnapshotRoutes(options as never) as never,
  )
  return app
}

describe("quote proposal routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.expireQuoteVersionIfPastValidUntil.mockResolvedValue(null)
  })

  it("describes the package-owned proposal and snapshot extensions", () => {
    const proposal = proposalRoutes.createQuoteProposalApiExtension(options as never)
    const snapshot = proposalRoutes.createQuoteVersionSnapshotApiExtension(options)

    expect(proposal).toMatchObject({
      extension: { name: "proposal", module: "quote-versions" },
      publicPath: "proposals",
      anonymous: true,
    })
    expect(proposal.lazyAdminRoutes).toBeTypeOf("function")
    expect(proposal.lazyPublicRoutes).toBeTypeOf("function")
    expect(snapshot).toMatchObject({
      extension: { name: "quote-version-snapshot", module: "trips" },
    })
    expect(snapshot.lazyAdminRoutes).toBeTypeOf("function")
  })

  it("builds root-relative and absolute proposal URLs", () => {
    expect(proposalRoutes.buildQuoteVersionProposalUrl("qver_123")).toBe("/proposal/qver_123")
    expect(
      proposalRoutes.buildQuoteVersionProposalUrl("qver 123", {
        baseUrl: "https://travel.example.com/",
      }),
    ).toBe("https://travel.example.com/proposal/qver%20123")
  })

  it("maps a stored trip snapshot proposal into a quote-version apply payload", () => {
    expect(proposalRoutes.tripSnapshotToQuoteVersionApply(tripSnapshot as never)).toEqual({
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

  it("returns and tracks a public sent proposal with the injected operator profile", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.markQuoteVersionViewed.mockResolvedValue({ ...quoteVersion, viewedAt: "2026-06-09" })

    const response = await app.request("/v1/public/proposals/qver_123", { method: "GET" })

    expect(response.status).toBe(200)
    expect(mocks.expireQuoteVersionIfPastValidUntil).toHaveBeenCalledWith(fakeDb, "qver_123")
    expect(mocks.markQuoteVersionViewed).toHaveBeenCalledWith(fakeDb, "qver_123")
    expect(options.resolveOperatorProfile).toHaveBeenCalledWith(fakeDb)
    const body = (await response.json()) as {
      data: Record<string, unknown> & { lines: Array<Record<string, unknown>> }
    }
    expect(body).toMatchObject({
      data: {
        title: "Romania private tour",
        status: "sent",
        currency: "EUR",
        totalAmountCents: 10900,
        acceptable: true,
        operator: { name: "Voyant Travel" },
        proposalUrl: "/proposal/qver_123",
        lines: [{ description: "Airport transfer", currency: "EUR" }],
      },
    })
    // Public payload omits internal CRM fields.
    expect(body.data.quote).toBeUndefined()
    expect(body.data.quoteVersion).toBeUndefined()
    expect(body.data.lines[0].id).toBeUndefined()
    expect(body.data.lines[0].productId).toBeUndefined()
  })

  it("marks sent line-item proposals as review-only on public reads", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue({
      ...proposal,
      quoteVersion: { ...quoteVersion, tripSnapshotId: null },
    })
    mocks.markQuoteVersionViewed.mockResolvedValue({ ...quoteVersion, tripSnapshotId: null })

    const response = await app.request("/v1/public/proposals/qver_123", { method: "GET" })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        acceptable: false,
        status: "sent",
      },
    })
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
    mocks.declineQuoteVersion.mockResolvedValue({ ...quoteVersion, status: "declined" })

    const response = await app.request("/v1/public/proposals/qver_123/decline", {
      method: "POST",
      ...json({}),
    })

    expect(response.status).toBe(200)
    expect(mocks.declineQuoteVersion).toHaveBeenCalledWith(fakeDb, "qver_123")
    await expect(response.json()).resolves.toEqual({ data: { status: "declined" } })
  })

  it("records requested edits without finalizing the sent proposal", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.recordPublicProposalFeedback.mockResolvedValue({ id: "act_123" })

    const response = await app.request("/v1/public/proposals/qver_123/request-edits", {
      method: "POST",
      ...json({ message: "Please add a private transfer option." }),
    })

    expect(response.status).toBe(200)
    expect(mocks.expireQuoteVersionIfPastValidUntil).toHaveBeenCalledWith(fakeDb, "qver_123")
    expect(mocks.recordPublicProposalFeedback).toHaveBeenCalledWith(
      fakeDb,
      {
        quoteId: "quot_123",
        quoteVersionId: "qver_123",
        message: "Please add a private transfer option.",
        proposalUrl: "/proposal/qver_123",
      },
      expect.any(Object),
    )
    expect(mocks.declineQuoteVersion).not.toHaveBeenCalled()
    expect(mocks.acceptQuoteVersion).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      data: { status: "sent", feedbackId: "act_123" },
    })
  })

  it("allows edit requests for sent line-item proposals that cannot be accepted", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue({
      ...proposal,
      quoteVersion: { ...quoteVersion, tripSnapshotId: null },
    })
    mocks.recordPublicProposalFeedback.mockResolvedValue({ id: "act_456" })

    const response = await app.request("/v1/public/proposals/qver_123/request-edits", {
      method: "POST",
      ...json({ message: "Can you quote a slower-paced itinerary?" }),
    })

    expect(response.status).toBe(200)
    expect(mocks.recordPublicProposalFeedback).toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      data: { status: "sent", feedbackId: "act_456" },
    })
  })

  it("accepts a sent proposal: prepare under lock, reserve outside txn, finalize under lock", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.getTripSnapshotById.mockResolvedValue(tripSnapshot)
    mocks.getTrip.mockResolvedValue(liveTrip)
    mocks.reserveTrip.mockResolvedValue({
      reserved: [{ componentId: "trcp_123", status: "held" }],
      failures: [],
      compensations: [],
      warnings: [],
    })
    mocks.acceptQuoteVersion.mockResolvedValue({
      quote: { ...proposal.quote, acceptedVersionId: "qver_123" },
      quoteVersion: { ...quoteVersion, status: "accepted" },
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
    // Two locked transactions now: prepare (txn 1) and finalize (txn 2). Each
    // acquires the quote-accept advisory lock via fakeTx.execute.
    expect(fakeDb.transaction).toHaveBeenCalledTimes(2)
    expect(fakeTx.execute).toHaveBeenCalledTimes(2)
    expect(mocks.getTripSnapshotById).toHaveBeenCalledWith(fakeTx, "trsn_123")
    // Reservation runs OUTSIDE the transaction, on the durable request db.
    expect(mocks.reserveTrip).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({
        envelopeId: "trip_123",
        idempotencyKey: "proposal-accept-reserve:qver_123:accept-1",
      }),
      { reserve: "deps" },
    )
    expect(mocks.acceptQuoteVersion).toHaveBeenCalledWith(fakeTx, "qver_123", {})
    expect(mocks.cancelComponents).not.toHaveBeenCalled()
    expect(mocks.startCheckout).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({
        intent: "card",
        idempotencyKey: "proposal-accept-checkout:qver_123:card:accept-1",
      }),
      { checkout: "deps" },
    )
    // Order: prepare lock -> reserve -> finalize lock -> accept.
    expect(fakeTx.execute.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reserveTrip.mock.invocationCallOrder[0],
    )
    expect(mocks.reserveTrip.mock.invocationCallOrder[0]).toBeLessThan(
      fakeTx.execute.mock.invocationCallOrder[1],
    )
    expect(fakeTx.execute.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.acceptQuoteVersion.mock.invocationCallOrder[0],
    )
    await expect(response.json()).resolves.toEqual({
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

  it("serializes the losing concurrent accept and never reserves its Trip", async () => {
    const app = makeApp()
    // The pre-lock precheck (line ~389) sees `sent`: this request raced a
    // sibling accept and passed the public status gate concurrently. By the
    // time it wins the quote-accept advisory lock, the sibling has committed
    // and flipped this version to `declined`, so the post-lock re-read bails
    // with 409 *before* reserveTrip runs — no orphan hold for the loser.
    mocks.getQuoteVersionProposal.mockResolvedValueOnce(proposal).mockResolvedValueOnce({
      ...proposal,
      quoteVersion: { ...quoteVersion, status: "declined" },
    })

    const response = await app.request("/v1/public/proposals/qver_123/accept", {
      method: "POST",
      ...json({}),
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "Proposal can no longer be accepted",
    })
    // The advisory lock must be acquired *before* the post-lock re-read that
    // observes the declined status — otherwise a "read-then-lock" ordering
    // would still 409 here while leaving the stale-read race wide open. The
    // first proposal read is the pre-lock precheck; the second is the
    // serialized re-read that must happen after the lock.
    const lockOrder = fakeTx.execute.mock.invocationCallOrder[0]
    const prelockReadOrder = mocks.getQuoteVersionProposal.mock.invocationCallOrder[0]
    const postlockReadOrder = mocks.getQuoteVersionProposal.mock.invocationCallOrder[1]
    expect(prelockReadOrder).toBeLessThan(lockOrder)
    expect(lockOrder).toBeLessThan(postlockReadOrder)
    // The loser neither reserved its Trip nor accepted the Quote Version.
    expect(mocks.reserveTrip).not.toHaveBeenCalled()
    expect(mocks.acceptQuoteVersion).not.toHaveBeenCalled()
  })

  it("rejects accepting when the proposal does not match the frozen snapshot", async () => {
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

  it("returns safe reservation failure details without accepting", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.getTripSnapshotById.mockResolvedValue(tripSnapshot)
    mocks.getTrip.mockResolvedValue(liveTrip)
    mocks.reserveTrip.mockResolvedValue({
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
    await expect(response.json()).resolves.toEqual({
      error: "Proposal could not be reserved",
      failures: [{ code: "price_changed", reason: "price_changed" }],
    })
  })

  it("reserves sourced catalog components outside the CRM accept transaction", async () => {
    const app = makeApp()
    const sourcedComponent = {
      ...frozenComponent,
      kind: "catalog_booking",
      sourceKind: "supplier_api",
      sourceConnectionId: "conn_123",
    }
    const sourcedSnapshot = {
      ...tripSnapshot,
      frozenComponents: [sourcedComponent],
    }
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.getTripSnapshotById.mockResolvedValue(sourcedSnapshot)
    mocks.getTrip.mockResolvedValue({ envelope: frozenEnvelope, components: [sourcedComponent] })
    mocks.reserveTrip.mockResolvedValue({
      reserved: [{ componentId: "trcp_123", status: "held" }],
      failures: [],
      compensations: [],
      warnings: [],
    })
    mocks.acceptQuoteVersion.mockResolvedValue({
      quote: { ...proposal.quote, acceptedVersionId: "qver_123" },
      quoteVersion: { ...quoteVersion, status: "accepted" },
      closedQuoteVersions: [],
    })
    mocks.startCheckout.mockResolvedValue({
      target: {
        currency: "EUR",
        totalAmountCents: 10900,
        paymentSessionId: null,
        checkoutUrl: null,
      },
      failures: [],
      warnings: [],
    })

    const response = await app.request("/v1/public/proposals/qver_123/accept", {
      method: "POST",
      ...json({}),
    })

    // Sourced catalog components are no longer rejected; they reserve outside
    // the CRM accept transaction and the proposal is accepted.
    expect(response.status).toBe(200)
    expect(mocks.reserveTrip).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({ envelopeId: "trip_123" }),
      { reserve: "deps" },
    )
    expect(mocks.acceptQuoteVersion).toHaveBeenCalledWith(fakeTx, "qver_123", {})
    expect(mocks.cancelComponents).not.toHaveBeenCalled()
  })

  it("releases the reserved trip when final CRM acceptance rejects", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.getTripSnapshotById.mockResolvedValue(tripSnapshot)
    mocks.getTrip.mockResolvedValue(liveTrip)
    mocks.reserveTrip.mockResolvedValue({
      reserved: [{ componentId: "trcp_123", status: "held" }],
      failures: [],
      compensations: [],
      warnings: [],
    })
    mocks.acceptQuoteVersion.mockRejectedValue(
      new mocks.QuoteVersionConflictError("Quote already has an accepted Quote Version"),
    )

    const response = await app.request("/v1/public/proposals/qver_123/accept", {
      method: "POST",
      ...json({ idempotencyKey: "accept-1" }),
    })

    expect(response.status).toBe(409)
    // The successful reservation is released so the supplier hold isn't orphaned.
    expect(mocks.cancelComponents).toHaveBeenCalledWith(
      fakeDb,
      {
        envelopeId: "trip_123",
        componentIds: ["trcp_123"],
        reason: "quote_accept_failed",
        idempotencyKey: "proposal-accept-release:qver_123:quote_accept_failed",
        request: {
          initiatedBy: "public-proposal-accept",
          quoteVersionId: "qver_123",
        },
      },
      { cancel: "deps" },
    )
    expect(mocks.startCheckout).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("accepted Quote Version"),
    })
  })

  it("does not release a replayed reservation when final CRM acceptance rejects", async () => {
    const app = makeApp()
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.getTripSnapshotById.mockResolvedValue(tripSnapshot)
    mocks.getTrip.mockResolvedValue(liveTrip)
    mocks.reserveTrip.mockResolvedValue({
      reserved: [{ componentId: "trcp_123", status: "held" }],
      failures: [],
      compensations: [],
      warnings: ["idempotent_replay"],
    })
    mocks.acceptQuoteVersion.mockRejectedValue(
      new mocks.QuoteVersionConflictError("Quote already has an accepted Quote Version"),
    )

    const response = await app.request("/v1/public/proposals/qver_123/accept", {
      method: "POST",
      ...json({ idempotencyKey: "accept-1" }),
    })

    expect(response.status).toBe(409)
    // A replay returns pre-existing holds; releasing them would cancel another
    // request's successful reservation.
    expect(mocks.cancelComponents).not.toHaveBeenCalled()
    expect(mocks.startCheckout).not.toHaveBeenCalled()
  })

  it("resumes a crashed acceptance whose Trip is already reserved under this proposal's key", async () => {
    const app = makeApp()
    // The reserve succeeded on a prior attempt but the worker died before
    // finalize accepted the quote: the version is still `sent` while the live
    // Trip is `reserved` under this proposal's reserve key.
    const reservedLiveTrip = {
      envelope: {
        ...frozenEnvelope,
        status: "reserved",
        reserveIdempotencyKey: "proposal-accept-reserve:qver_123:accept-1",
      },
      components: [{ ...frozenComponent, status: "held" }],
    }
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.getTripSnapshotById.mockResolvedValue(tripSnapshot)
    mocks.getTrip.mockResolvedValue(reservedLiveTrip)
    // reserveTrip replays the existing hold idempotently instead of re-holding.
    mocks.reserveTrip.mockResolvedValue({
      reserved: [{ componentId: "trcp_123", status: "held" }],
      failures: [],
      compensations: [],
      warnings: ["idempotent_replay"],
    })
    mocks.acceptQuoteVersion.mockResolvedValue({
      quote: { ...proposal.quote, acceptedVersionId: "qver_123" },
      quoteVersion: { ...quoteVersion, status: "accepted" },
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
      ...json({ idempotencyKey: "accept-1" }),
    })

    // The reserved-but-unaccepted state recovers instead of wedging on 409.
    expect(response.status).toBe(200)
    expect(mocks.reserveTrip).toHaveBeenCalled()
    expect(mocks.acceptQuoteVersion).toHaveBeenCalledWith(fakeTx, "qver_123", {})
    expect(mocks.cancelComponents).not.toHaveBeenCalled()
  })

  it("still rejects a live Trip reserved under a different (non-proposal) key", async () => {
    const app = makeApp()
    // A Trip reserved outside this proposal flow (e.g. a staff reserve) carries
    // a non-matching key, so it must remain a "Trip changed since sent" 409.
    const foreignReservedTrip = {
      envelope: {
        ...frozenEnvelope,
        status: "reserved",
        reserveIdempotencyKey: "staff-reserve:other",
      },
      components: [{ ...frozenComponent, status: "held" }],
    }
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.getTripSnapshotById.mockResolvedValue(tripSnapshot)
    mocks.getTrip.mockResolvedValue(foreignReservedTrip)

    const response = await app.request("/v1/public/proposals/qver_123/accept", {
      method: "POST",
      ...json({ idempotencyKey: "accept-1" }),
    })

    expect(response.status).toBe(409)
    expect(mocks.reserveTrip).not.toHaveBeenCalled()
    expect(mocks.acceptQuoteVersion).not.toHaveBeenCalled()
  })

  it("freezes and applies a snapshot to a draft quote version", async () => {
    const app = makeApp()
    mocks.getQuoteVersionById.mockResolvedValue({ id: "qver_123", status: "draft" })
    mocks.freezeTripSnapshot.mockResolvedValue(tripSnapshot)
    mocks.applyTripSnapshotToQuoteVersion.mockResolvedValue({
      quoteVersion: { id: "qver_123", status: "draft", tripSnapshotId: "trsn_123" },
      lines: [],
    })

    const response = await app.request(
      "/v1/admin/trips/trip_123/quote-versions/qver_123/snapshot",
      { method: "POST", ...json({ createdBy: "agent_1" }) },
    )

    expect(response.status).toBe(201)
    expect(mocks.freezeTripSnapshot).toHaveBeenCalledWith(fakeDb, {
      envelopeId: "trip_123",
      createdBy: "user_1",
    })
    expect(mocks.applyTripSnapshotToQuoteVersion).toHaveBeenCalledWith(
      fakeDb,
      "qver_123",
      expect.objectContaining({ tripSnapshotId: "trsn_123" }),
    )
    await expect(response.json()).resolves.toMatchObject({
      data: { snapshot: { id: "trsn_123" }, quoteVersion: { id: "qver_123" } },
    })
  })

  it("rejects non-draft quote versions before freezing a snapshot", async () => {
    const app = makeApp()
    mocks.getQuoteVersionById.mockResolvedValue({ id: "qver_123", status: "sent" })

    const response = await app.request(
      "/v1/admin/trips/trip_123/quote-versions/qver_123/snapshot",
      { method: "POST", ...json({}) },
    )

    expect(response.status).toBe(409)
    expect(mocks.freezeTripSnapshot).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("draft"),
    })
  })
})
