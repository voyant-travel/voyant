import { describe, expect, it, vi } from "vitest"

import type { SourceAdapter } from "../adapter/contract.js"
import type { SelectBookingCatalogSnapshot } from "../snapshot/schema.js"

import { bookEntity } from "./book.js"
import { cancelEntity } from "./cancel.js"
import { quoteEntity } from "./quote.js"
import { createSourceAdapterRegistry } from "./registry.js"
import type { SelectCatalogQuote } from "./schema.js"

vi.mock("../services/snapshot-service.js", () => ({
  captureSnapshot: vi.fn(async () => ({ id: "snap_1" })),
}))

function makeQuoteDb() {
  return {
    insert() {
      return {
        values() {
          return {
            async returning() {
              return [{ id: "cquo_1" }]
            },
          }
        },
      }
    },
  } as never
}

function makeBookDb(quote: SelectCatalogQuote) {
  return {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                async limit() {
                  return [quote]
                },
              }
            },
          }
        },
      }
    },
    update() {
      return {
        set() {
          return {
            async where() {},
          }
        },
      }
    },
  } as never
}

function makeCancelDb(snapshot: SelectBookingCatalogSnapshot) {
  return {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                async limit() {
                  return [snapshot]
                },
              }
            },
          }
        },
      }
    },
  } as never
}

function makeAdapter(overrides: Partial<SourceAdapter>): SourceAdapter {
  return {
    kind: "voyant-connect",
    capabilities: {
      verticals: ["cruises"],
      supportsLiveResolution: true,
      supportsDriftDetection: false,
      supportsBookingForwarding: true,
      postBookOperations: ["cancel"],
    },
    connect: async () => undefined,
    pause: async () => undefined,
    disconnect: async () => undefined,
    getState: async () => "active",
    discover: async () => ({ projections: [], next_cursor: undefined }),
    ...overrides,
  }
}

function catalogQuote(overrides: Partial<SelectCatalogQuote> = {}): SelectCatalogQuote {
  const now = new Date()
  return {
    id: "cquo_1",
    entity_module: "cruises",
    entity_id: "cruise_1",
    source_kind: "voyant-connect",
    source_provider: null,
    source_connection_id: "conn_voyant",
    source_ref: "upstream_1",
    available: true,
    invalid_reason: null,
    locale: "en-GB",
    audience: "customer",
    market: "default",
    currency: "EUR",
    pricing_base_amount: "10000",
    pricing_taxes: "0",
    pricing_fees: "0",
    pricing_surcharges: "0",
    pricing_currency: "EUR",
    pricing_breakdown: null,
    pricing_applied_offers: null,
    upstream_payload: null,
    consumed_at: null,
    consumed_booking_id: null,
    created_at: now,
    expires_at: new Date(now.getTime() + 60_000),
    updated_at: now,
    ...overrides,
  } as SelectCatalogQuote
}

function catalogSnapshot(
  overrides: Partial<SelectBookingCatalogSnapshot> = {},
): SelectBookingCatalogSnapshot {
  const now = new Date()
  return {
    id: "snap_1",
    booking_id: "booking_1",
    entity_module: "cruises",
    entity_id: "cruise_1",
    source_kind: "voyant-connect",
    source_provider: null,
    source_connection_id: "conn_voyant",
    source_ref: "order_1",
    frozen_payload: {},
    pricing_base_amount: "10000",
    pricing_taxes: "0",
    pricing_fees: "0",
    pricing_surcharges: "0",
    pricing_currency: "EUR",
    pricing_breakdown: null,
    pricing_applied_offers: null,
    idempotency_key: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as SelectBookingCatalogSnapshot
}

describe("booking engine source connection context", () => {
  it("uses sourceConnectionId for sourced liveResolve calls", async () => {
    const liveResolve = vi.fn(async () => ({
      values: { cruise_1: { priceCents: 10000, currency: "EUR" } },
    }))
    const registry = createSourceAdapterRegistry()
    registry.register("conn_voyant", makeAdapter({ liveResolve }))

    await quoteEntity(
      makeQuoteDb(),
      { registry },
      {
        entityModule: "cruises",
        entityId: "cruise_1",
        sourceKind: "voyant-connect",
        sourceConnectionId: "conn_voyant",
        scope: { locale: "en-GB", audience: "customer", market: "default", currency: "EUR" },
        adapterContext: { connection_id: "engine", correlation_id: "req_1" },
      },
    )

    expect(liveResolve).toHaveBeenCalledWith(
      expect.objectContaining({ connection_id: "conn_voyant", correlation_id: "req_1" }),
      expect.any(Object),
    )
  })

  it("uses quote source_connection_id for reserve calls", async () => {
    const reserve = vi.fn(async () => ({
      status: "held" as const,
      upstream_ref: "order_1",
      upstream_payload: {},
    }))
    const registry = createSourceAdapterRegistry()
    registry.register("conn_voyant", makeAdapter({ reserve }))

    await bookEntity(
      makeBookDb(catalogQuote()),
      { registry },
      {
        quoteId: "cquo_1",
        adapterContext: { connection_id: "engine", correlation_id: "req_2" },
      },
    )

    expect(reserve).toHaveBeenCalledWith(
      expect.objectContaining({ connection_id: "conn_voyant", correlation_id: "req_2" }),
      expect.any(Object),
    )
  })

  it("uses snapshot source_connection_id for cancel calls", async () => {
    const cancel = vi.fn(async () => ({
      status: "cancelled" as const,
    }))
    const registry = createSourceAdapterRegistry()
    registry.register("conn_voyant", makeAdapter({ cancel }))

    await cancelEntity(
      makeCancelDb(catalogSnapshot()),
      { registry },
      {
        bookingId: "booking_1",
        entityModule: "cruises",
        entityId: "cruise_1",
        adapterContext: { connection_id: "engine", correlation_id: "req_3" },
      },
    )

    expect(cancel).toHaveBeenCalledWith(
      expect.objectContaining({ connection_id: "conn_voyant", correlation_id: "req_3" }),
      expect.any(Object),
    )
  })
})
