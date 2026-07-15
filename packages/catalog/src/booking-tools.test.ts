import { createToolRegistry } from "@voyant-travel/tools"
import { describe, expect, it, vi } from "vitest"

import {
  type CatalogBookingToolContext,
  catalogBookingTools,
  commitCatalogBookingTool,
  quoteCatalogEntityTool,
} from "./booking-tools.js"

function context(): CatalogBookingToolContext {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "tenant-1",
    resolverScope: {
      locale: "en-GB",
      audience: "staff",
      market: "uk",
      actor: "staff",
    },
    catalogBooking: {
      quote: vi.fn(async () => ({
        quoteId: "quote_1",
        quotedAt: "2026-07-15T12:00:00.000Z",
        expiresAt: "2026-07-15T12:10:00.000Z",
        available: true,
      })),
      commit: vi.fn(async () => ({
        bookingId: "booking_1",
        orderRef: "order_1",
        status: "confirmed",
        snapshotId: "snapshot_1",
      })),
      listOrders: vi.fn(async () => ({ rows: [] })),
      getOrder: vi.fn(async () => null),
    },
  }
}

describe("catalog booking tools", () => {
  it("publishes provider-neutral quote, commit, and order capabilities", () => {
    expect(catalogBookingTools).toHaveLength(4)
    expect(new Set(catalogBookingTools.map((tool) => tool.capabilityId)).size).toBe(4)
    expect(() => createToolRegistry().registerAll(catalogBookingTools)).not.toThrow()
  })

  it("defaults quote scope from the authenticated tool context", async () => {
    const ctx = context()
    await quoteCatalogEntityTool.handler({ entityModule: "products", entityId: "product_1" }, ctx)
    expect(ctx.catalogBooking?.quote).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: expect.objectContaining({ locale: "en-GB", audience: "staff", market: "uk" }),
      }),
    )
  })

  it("requires confirmation for externally committing a booking", () => {
    expect(commitCatalogBookingTool.requiredScopes).toEqual(["catalog:read", "bookings:write"])
    expect(commitCatalogBookingTool.riskPolicy).toMatchObject({
      destructive: true,
      reversible: false,
      confirmationRequired: true,
      sideEffects: ["external-booking", "data-write"],
    })
  })
})
