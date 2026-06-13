import { Hono } from "hono"
import { vi } from "vitest"

const mockRegistry = vi.hoisted(() => {
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

export const mocks = mockRegistry

vi.mock("@voyantjs/quotes", async () => {
  const { z } = await import("zod")
  return {
    QuoteVersionConflictError: mockRegistry.QuoteVersionConflictError,
    sendQuoteVersionSchema: z.object({
      validUntil: z.string().date().nullable().optional(),
    }),
    quotesService: {
      acceptQuoteVersion: mockRegistry.acceptQuoteVersion,
      declineQuoteVersion: mockRegistry.declineQuoteVersion,
      expireQuoteVersionIfPastValidUntil: mockRegistry.expireQuoteVersionIfPastValidUntil,
      getQuoteVersionProposal: mockRegistry.getQuoteVersionProposal,
      markQuoteVersionViewed: mockRegistry.markQuoteVersionViewed,
      sendQuoteVersion: mockRegistry.sendQuoteVersion,
    },
  }
})

vi.mock("@voyantjs/trip-composer", () => {
  class TripComposerInvariantError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "TripComposerInvariantError"
    }
  }
  return {
    TripComposerInvariantError,
    tripComposerService: {
      getTrip: mockRegistry.getTrip,
      getTripSnapshotById: mockRegistry.getTripSnapshotById,
      reserveTrip: mockRegistry.reserveTrip,
      startCheckout: mockRegistry.startCheckout,
    },
  }
})

vi.mock("./operator-runtime-adapter", () => ({
  operatorPostgresDb: (db: unknown) => db,
}))

vi.mock("./settings", () => ({
  getOperatorSettings: mockRegistry.getOperatorSettings,
  toPublicOperatorSettings: (settings: unknown) => settings,
}))

vi.mock("./trip-composer-runtime", () => ({
  createReserveTripDeps: () => ({ reserve: "deps" }),
  createStartCheckoutDeps: () => ({ checkout: "deps" }),
}))

const proposalRoutes = await import("./proposal-routes")

export const buildQuoteVersionProposalUrl = proposalRoutes.buildQuoteVersionProposalUrl

export const fakeTx = { execute: vi.fn(), name: "tx" }
export const fakeDb = {
  name: "db",
  transaction: vi.fn(async (callback: (tx: typeof fakeTx) => Promise<unknown>) => callback(fakeTx)),
}

export const quoteVersion = {
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

export const proposal = {
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

export const frozenComponent = {
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

export const tripSnapshot = {
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

export const liveTrip = {
  envelope: frozenEnvelope,
  components: [frozenComponent],
}

export function json(body: Record<string, unknown>) {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }
}

export function makeApp() {
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("db" as never, fakeDb as never)
    await next()
  })
  proposalRoutes.mountOperatorProposalRoutes(app as never)
  return app
}
