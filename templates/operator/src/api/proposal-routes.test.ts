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
    declineQuoteVersion: vi.fn(),
    expireQuoteVersionIfPastValidUntil: vi.fn(),
    getOperatorSettings: vi.fn(),
    getQuoteVersionProposal: vi.fn(),
    markQuoteVersionViewed: vi.fn(),
    sendQuoteVersion: vi.fn(),
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
      declineQuoteVersion: mocks.declineQuoteVersion,
      expireQuoteVersionIfPastValidUntil: mocks.expireQuoteVersionIfPastValidUntil,
      getQuoteVersionProposal: mocks.getQuoteVersionProposal,
      markQuoteVersionViewed: mocks.markQuoteVersionViewed,
      sendQuoteVersion: mocks.sendQuoteVersion,
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

import { buildQuoteVersionProposalUrl, mountOperatorProposalRoutes } from "./proposal-routes"

const fakeDb = { name: "db" }
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
})
