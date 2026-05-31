import { handleApiError } from "@voyantjs/hono"
import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PricingBasis } from "../snapshot/schema.js"

import { bookEntity } from "./book.js"
import {
  createBookingDraft,
  deleteBookingDraft,
  getBookingDraft,
  markDraftConsumed,
  updateBookingDraft,
} from "./drafts-service.js"
import { createOwnedBookingHandlerRegistry, type OwnedBookingHandler } from "./owned-handler.js"
import { quoteEntity } from "./quote.js"
import { createSourceAdapterRegistry } from "./registry.js"
import {
  type CatalogBookingRoutesOptions,
  createCatalogBookingHonoModule,
  createCatalogBookingRoutes,
} from "./routes.js"

vi.mock("./quote.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./quote.js")>()
  return { ...actual, quoteEntity: vi.fn() }
})

vi.mock("./book.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./book.js")>()
  return { ...actual, bookEntity: vi.fn() }
})

vi.mock("./drafts-service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./drafts-service.js")>()
  return {
    ...actual,
    createBookingDraft: vi.fn(),
    deleteBookingDraft: vi.fn(),
    getBookingDraft: vi.fn(),
    markDraftConsumed: vi.fn(),
    updateBookingDraft: vi.fn(),
  }
})

const db = { kind: "db" } as never
const registry = createSourceAdapterRegistry()

function createTestApp(overrides: Partial<CatalogBookingRoutesOptions> = {}) {
  const ownedHandlers = createOwnedBookingHandlerRegistry()
  const app = new Hono()
  app.onError(handleApiError)
  app.route(
    "/v1/public/catalog",
    createCatalogBookingRoutes({
      resolveDb: () => db,
      resolveSourceRegistry: () => registry,
      resolveOwnedHandlers: () => ownedHandlers,
      ...overrides,
    }),
  )
  return { app, ownedHandlers }
}

const pricing: PricingBasis = {
  base_amount: 10000,
  taxes: 1900,
  fees: 250,
  surcharges: 0,
  currency: "EUR",
}

describe("createCatalogBookingRoutes", () => {
  beforeEach(() => {
    vi.mocked(bookEntity).mockReset()
    vi.mocked(createBookingDraft).mockReset()
    vi.mocked(deleteBookingDraft).mockReset()
    vi.mocked(getBookingDraft).mockReset()
    vi.mocked(markDraftConsumed).mockReset()
    vi.mocked(quoteEntity).mockReset()
    vi.mocked(updateBookingDraft).mockReset()
  })

  it("exposes both admin and public routes through the Hono module wrapper", () => {
    const module = createCatalogBookingHonoModule({
      resolveDb: () => db,
      resolveSourceRegistry: () => registry,
    })

    expect(module.module.name).toBe("catalog")
    expect(module.adminRoutes).toBeTruthy()
    expect(module.publicRoutes).toBeTruthy()
  })

  it("uses shared JSON validation errors for invalid bodies", async () => {
    const { app } = createTestApp()

    const response = await app.request("/v1/public/catalog/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid JSON body",
      code: "invalid_request",
    })
  })

  it("quotes through injected provenance, registries, and adapter context", async () => {
    vi.mocked(quoteEntity).mockResolvedValue({
      quoteId: "quote_1",
      quotedAt: new Date("2026-05-05T10:00:00.000Z"),
      expiresAt: new Date("2026-05-05T10:10:00.000Z"),
      available: true,
      pricing,
      upstreamPayload: { ok: true },
    })
    const resolveEntityProvenance = vi.fn(async () => ({
      sourceKind: "demo",
      sourceConnectionId: "conn_demo",
      sourceRef: "upstream_1",
    }))
    const resolveAdapterContext = vi.fn(({ sourceConnectionId, correlationId }) => ({
      connection_id: sourceConnectionId ?? "fallback",
      correlation_id: correlationId,
      credentials: { token: "secret" },
    }))
    const { app, ownedHandlers } = createTestApp({
      resolveCorrelationId: () => "req_1",
      resolveEntityProvenance,
      resolveAdapterContext,
    })

    const response = await app.request("/v1/public/catalog/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityModule: "products",
        entityId: "prod_1",
        draft: { configure: { departureSlotId: "slot_1", pax: { adult: 2 } } },
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      quoteId: "quote_1",
      quotedAt: "2026-05-05T10:00:00.000Z",
      pricing: {
        currency: "EUR",
        subtotal: 10250,
        taxTotal: 1900,
        total: 12150,
      },
    })
    expect(resolveEntityProvenance).toHaveBeenCalledWith(
      expect.objectContaining({ db, entityModule: "products", entityId: "prod_1" }),
    )
    expect(quoteEntity).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ registry, ownedHandlers }),
      expect.objectContaining({
        entityModule: "products",
        entityId: "prod_1",
        sourceKind: "demo",
        sourceConnectionId: "conn_demo",
        sourceRef: "upstream_1",
        scope: {
          locale: "en-GB",
          audience: "customer",
          market: "default",
          currency: undefined,
        },
        parameters: expect.objectContaining({
          draft: expect.any(Object),
          departureSlotId: "slot_1",
          departure_id: "slot_1",
          slotId: "slot_1",
          paxCount: 2,
        }),
        adapterContext: {
          connection_id: "conn_demo",
          correlation_id: "req_1",
          credentials: { token: "secret" },
        },
      }),
    )
  })

  it("fills missing source connection provenance for explicit sourced quote requests", async () => {
    vi.mocked(quoteEntity).mockResolvedValue({
      quoteId: "quote_1",
      quotedAt: new Date("2026-05-05T10:00:00.000Z"),
      expiresAt: new Date("2026-05-05T10:10:00.000Z"),
      available: true,
      pricing,
    })
    const resolveEntityProvenance = vi.fn(async () => ({
      sourceKind: "voyant-connect",
      sourceProvider: "croisi",
      sourceConnectionId: "conn_voyant",
      sourceRef: "upstream_1",
    }))
    const resolveAdapterContext = vi.fn(({ sourceConnectionId, correlationId }) => ({
      connection_id: sourceConnectionId ?? "fallback",
      correlation_id: correlationId,
    }))
    const { app } = createTestApp({
      resolveCorrelationId: () => "req_1",
      resolveEntityProvenance,
      resolveAdapterContext,
    })

    const response = await app.request("/v1/public/catalog/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityModule: "cruises",
        entityId: "cruise_1",
        sourceKind: "voyant-connect",
        draft: { configure: { departureSlotId: "slot_1", pax: { adult: 2 } } },
      }),
    })

    expect(response.status).toBe(200)
    expect(resolveEntityProvenance).toHaveBeenCalledWith(
      expect.objectContaining({ db, entityModule: "cruises", entityId: "cruise_1" }),
    )
    expect(quoteEntity).toHaveBeenCalledWith(
      db,
      expect.any(Object),
      expect.objectContaining({
        sourceKind: "voyant-connect",
        sourceProvider: "croisi",
        sourceConnectionId: "conn_voyant",
        sourceRef: "upstream_1",
        adapterContext: { connection_id: "conn_voyant", correlation_id: "req_1" },
      }),
    )
  })

  it("creates drafts with actor identity and explicit source provenance", async () => {
    vi.mocked(getBookingDraft).mockResolvedValue(null)
    vi.mocked(createBookingDraft).mockResolvedValue({
      id: "draft_1",
      entity_module: "products",
      entity_id: "prod_1",
      source_kind: "owned",
      source_connection_id: null,
      source_ref: null,
      draft_payload: { entity: { id: "prod_1" } },
      current_step: "configure",
      current_quote_id: null,
      hold_expires_at: null,
      consumed_booking_id: null,
      consumed_at: null,
      created_by: "user_1",
      expires_at: new Date("2026-05-06T10:00:00.000Z"),
      created_at: new Date("2026-05-05T10:00:00.000Z"),
      updated_at: new Date("2026-05-05T10:00:00.000Z"),
    } as never)
    const { app } = createTestApp({ resolveActorId: () => "user_1" })

    const response = await app.request("/v1/public/catalog/drafts/draft_1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityModule: "products",
        entityId: "prod_1",
        sourceKind: "owned",
        draftPayload: { entity: { id: "prod_1" } },
        currentStep: "configure",
      }),
    })

    expect(response.status).toBe(201)
    expect(createBookingDraft).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        id: "draft_1",
        entityModule: "products",
        entityId: "prod_1",
        sourceKind: "owned",
        createdBy: "user_1",
      }),
    )
  })

  it("books draft-first, forwards draft parameters, and reports draft consume races", async () => {
    vi.mocked(getBookingDraft).mockResolvedValue({
      id: "draft_1",
      current_quote_id: "quote_1",
      draft_payload: { configure: { departureSlotId: "slot_1", pax: { adult: 2 } } },
    } as never)
    vi.mocked(bookEntity).mockResolvedValue({
      bookingId: "booking_1",
      orderRef: "order_1",
      status: "held",
      snapshotId: "snap_1",
      pricing,
    })
    const consumeError = new Error("race")
    vi.mocked(markDraftConsumed).mockRejectedValue(consumeError)
    const onDraftConsumedError = vi.fn()
    const onCommitted = vi.fn()
    const { app } = createTestApp({
      resolveCorrelationId: () => "req_2",
      onDraftConsumedError,
      onCommitted,
    })

    const response = await app.request("/v1/public/catalog/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftId: "draft_1", idempotencyKey: "idem_12345678" }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      bookingId: "booking_1",
      pricing: { total: 12150 },
    })
    expect(bookEntity).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ registry }),
      expect.objectContaining({
        quoteId: "quote_1",
        idempotencyKey: "idem_12345678",
        parameters: expect.objectContaining({
          draft: expect.any(Object),
          departureSlotId: "slot_1",
          departure_id: "slot_1",
          slotId: "slot_1",
          paxCount: 2,
        }),
        adapterContext: { connection_id: "engine", correlation_id: "req_2" },
      }),
    )
    expect(onDraftConsumedError).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: "draft_1",
        bookingId: "booking_1",
        error: consumeError,
      }),
    )
    expect(onCommitted).toHaveBeenCalledWith(
      expect.objectContaining({ result: expect.objectContaining({ bookingId: "booking_1" }) }),
    )
  })

  it("places and releases holds through the owned handler registry", async () => {
    const placeHold = vi.fn(async () => ({
      holdToken: "hold_1",
      expiresAt: new Date("2026-05-05T10:30:00.000Z"),
    }))
    const releaseHold = vi.fn(async () => undefined)
    const handler: OwnedBookingHandler = {
      entityModule: "products",
      computeQuote: async () => ({ available: true }),
      commit: async () => ({ status: "held", orderRef: "order_1" }),
      placeHold,
      releaseHold,
    }
    const { app, ownedHandlers } = createTestApp({
      resolveCorrelationId: () => "req_3",
      resolveHoldTtlMs: async () => 15 * 60 * 1000,
    })
    ownedHandlers.register(handler)

    const placeResponse = await app.request("/v1/public/catalog/holds/place", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entityModule: "products", entityId: "prod_1", draftId: "draft_1" }),
    })
    expect(placeResponse.status).toBe(200)
    await expect(placeResponse.json()).resolves.toEqual({
      holdToken: "hold_1",
      expiresAt: "2026-05-05T10:30:00.000Z",
    })
    expect(placeHold).toHaveBeenCalledWith(
      { db, adapterContext: { connection_id: "engine", correlation_id: "req_3" } },
      expect.objectContaining({ ttlMs: 15 * 60 * 1000 }),
    )

    const releaseResponse = await app.request("/v1/public/catalog/holds/release", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entityModule: "products", holdToken: "hold_1" }),
    })
    expect(releaseResponse.status).toBe(204)
    expect(releaseHold).toHaveBeenCalledWith(
      { db, adapterContext: { connection_id: "engine", correlation_id: "req_3" } },
      "hold_1",
    )
  })
})
