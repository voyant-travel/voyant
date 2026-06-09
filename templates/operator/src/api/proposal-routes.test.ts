import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildQuoteVersionProposalUrl,
  fakeDb,
  fakeTx,
  frozenComponent,
  json,
  liveTrip,
  makeApp,
  mocks,
  proposal,
  quoteVersion,
  tripSnapshot,
} from "./proposal-routes.test-helpers"

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
    expect(fakeDb.transaction).toHaveBeenCalledTimes(2)
    expect(fakeTx.execute).toHaveBeenCalledTimes(2)
    expect(mocks.getTripSnapshotById).toHaveBeenCalledWith(fakeTx, "trsn_123")
    expect(mocks.getTrip).toHaveBeenCalledWith(fakeTx, "trip_123")
    expect(mocks.reserveTrip).toHaveBeenCalledWith(
      fakeDb,
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
    expect(fakeTx.execute.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.acceptQuoteVersion.mock.invocationCallOrder[0],
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

  it("reserves sourced catalog components outside the CRM accept transaction", async () => {
    const app = makeApp()
    const sourcedCatalogComponent = {
      ...frozenComponent,
      kind: "catalog_booking",
      sourceKind: "external_supplier",
    }
    mocks.getQuoteVersionProposal.mockResolvedValue(proposal)
    mocks.getTripSnapshotById.mockResolvedValue({
      ...tripSnapshot,
      frozenComponents: [sourcedCatalogComponent],
      proposal: {
        ...tripSnapshot.proposal,
        lines: [
          {
            ...tripSnapshot.proposal.lines[0],
            kind: "catalog_booking",
            sourceKind: "external_supplier",
          },
        ],
      },
    })
    mocks.getTrip.mockResolvedValue({
      ...liveTrip,
      components: [sourcedCatalogComponent],
    })
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

    expect(response.status).toBe(200)
    expect(fakeDb.transaction).toHaveBeenCalledTimes(2)
    expect(mocks.reserveTrip).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({ envelopeId: "trip_123" }),
      { reserve: "deps" },
    )
    expect(mocks.acceptQuoteVersion).toHaveBeenCalledWith(fakeTx, "qver_123", {})
    expect(mocks.cancelComponents).not.toHaveBeenCalled()
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

  it("releases the reserved trip when final CRM acceptance rejects", async () => {
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
    mocks.acceptQuoteVersion.mockRejectedValue(
      new mocks.QuoteVersionConflictError("Quote already has an accepted Quote Version"),
    )

    const response = await app.request("/v1/public/proposals/qver_123/accept", {
      method: "POST",
      ...json({ idempotencyKey: "accept-1" }),
    })

    expect(response.status).toBe(409)
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
    const body = (await response.json()) as { error?: string }
    expect(body.error).toContain("accepted Quote Version")
  })

  it("does not release a replayed reservation when final CRM acceptance rejects", async () => {
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
    expect(mocks.cancelComponents).not.toHaveBeenCalled()
    expect(mocks.startCheckout).not.toHaveBeenCalled()
  })
})
