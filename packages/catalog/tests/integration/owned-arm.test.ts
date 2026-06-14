/**
 * Integration test for the owned-arm booking dispatch — registers a
 * stub OwnedBookingHandler, calls quoteEntity → bookEntity end-to-end,
 * and verifies catalog_quotes + booking_catalog_snapshot rows.
 *
 * Skips locally if `TEST_DATABASE_URL` is unset or the connection fails.
 */

import { createTestDb } from "@voyant-travel/db/test-utils"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { bookEntity } from "../../src/booking-engine/book.js"
import {
  createOwnedBookingHandlerRegistry,
  type OwnedBookingHandler,
} from "../../src/booking-engine/owned-handler.js"
import { quoteEntity } from "../../src/booking-engine/quote.js"
import { createSourceAdapterRegistry } from "../../src/booking-engine/registry.js"
import { catalogQuotesTable } from "../../src/booking-engine/schema.js"
import { bookingCatalogSnapshotTable } from "../../src/snapshot/schema.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
let DB_AVAILABLE = false

if (TEST_DATABASE_URL) {
  try {
    const probe = createTestDb()
    await probe.execute(/* sql */ `SELECT 1`)
    DB_AVAILABLE = true
  } catch {
    DB_AVAILABLE = false
  }
}

describe.skipIf(!DB_AVAILABLE)("Owned-arm dispatch integration", () => {
  let db: PostgresJsDatabase
  const createdQuoteIds: string[] = []
  const createdBookingIds: string[] = []

  beforeAll(() => {
    db = createTestDb()
  })

  afterEach(async () => {
    for (const id of createdBookingIds) {
      await db
        .delete(bookingCatalogSnapshotTable)
        .where(eq(bookingCatalogSnapshotTable.booking_id, id))
    }
    for (const id of createdQuoteIds) {
      await db.delete(catalogQuotesTable).where(eq(catalogQuotesTable.id, id))
    }
    createdQuoteIds.length = 0
    createdBookingIds.length = 0
  })

  afterAll(() => {
    // Defensive sweep — afterEach handles per-test cleanup.
  })

  function buildHandler(overrides?: Partial<OwnedBookingHandler>): OwnedBookingHandler {
    return {
      entityModule: "products",
      async computeQuote() {
        return {
          available: true,
          pricing: {
            base_amount: 5000,
            taxes: 950,
            fees: 0,
            surcharges: 0,
            currency: "EUR",
          },
        }
      },
      async commit(_ctx, request) {
        return {
          status: "held",
          orderRef: `ord_test_${request.bookingId}`,
          pricing: request.pricing,
          upstreamPayload: { stub: true },
        }
      },
      ...overrides,
    }
  }

  it("dispatches quoteEntity through the owned-handler registry for sourceKind=owned", async () => {
    const ownedHandlers = createOwnedBookingHandlerRegistry()
    const handler = buildHandler()
    ownedHandlers.register(handler)
    const registry = createSourceAdapterRegistry()

    const result = await quoteEntity(
      db,
      { registry, ownedHandlers },
      {
        entityModule: "products",
        entityId: "prod_test",
        sourceKind: "owned",
        scope: { locale: "en-GB", audience: "staff", market: "default" },
        adapterContext: { connection_id: "engine" },
      },
    )
    createdQuoteIds.push(result.quoteId)

    expect(result.available).toBe(true)
    expect(result.pricing?.base_amount).toBe(5000)

    const [persisted] = await db
      .select()
      .from(catalogQuotesTable)
      .where(eq(catalogQuotesTable.id, result.quoteId))
    expect(persisted?.entity_module).toBe("products")
    expect(persisted?.source_kind).toBe("owned")
    expect(persisted?.available).toBe(true)
  })

  it("dispatches bookEntity through the owned-handler registry and writes a snapshot", async () => {
    const ownedHandlers = createOwnedBookingHandlerRegistry()
    ownedHandlers.register(buildHandler())
    const registry = createSourceAdapterRegistry()

    const quote = await quoteEntity(
      db,
      { registry, ownedHandlers },
      {
        entityModule: "products",
        entityId: "prod_test_2",
        sourceKind: "owned",
        scope: { locale: "en-GB", audience: "staff", market: "default" },
        adapterContext: { connection_id: "engine" },
      },
    )
    createdQuoteIds.push(quote.quoteId)

    const result = await bookEntity(
      db,
      { registry, ownedHandlers },
      {
        quoteId: quote.quoteId,
        adapterContext: { connection_id: "engine" },
      },
    )
    createdBookingIds.push(result.bookingId)

    expect(result.status).toBe("held")
    expect(result.orderRef).toContain("ord_test_")
    expect(result.snapshotId).toBeTruthy()

    const [snapshot] = await db
      .select()
      .from(bookingCatalogSnapshotTable)
      .where(eq(bookingCatalogSnapshotTable.id, result.snapshotId))
    expect(snapshot?.booking_id).toBe(result.bookingId)
    expect(snapshot?.entity_module).toBe("products")
    expect(snapshot?.source_kind).toBe("owned")

    // Quote must be marked consumed.
    const [consumedQuote] = await db
      .select()
      .from(catalogQuotesTable)
      .where(eq(catalogQuotesTable.id, quote.quoteId))
    expect(consumedQuote?.consumed_at).toBeTruthy()
    expect(consumedQuote?.consumed_booking_id).toBe(result.bookingId)
  })

  it("idempotency key short-circuits a duplicate book", async () => {
    const ownedHandlers = createOwnedBookingHandlerRegistry()
    ownedHandlers.register(buildHandler())
    const registry = createSourceAdapterRegistry()

    const quote = await quoteEntity(
      db,
      { registry, ownedHandlers },
      {
        entityModule: "products",
        entityId: "prod_test_3",
        sourceKind: "owned",
        scope: { locale: "en-GB", audience: "staff", market: "default" },
        adapterContext: { connection_id: "engine" },
      },
    )
    createdQuoteIds.push(quote.quoteId)

    const idempotencyKey = `test_idemp_${Date.now()}`
    const first = await bookEntity(
      db,
      { registry, ownedHandlers },
      {
        quoteId: quote.quoteId,
        idempotencyKey,
        adapterContext: { connection_id: "engine" },
      },
    )
    createdBookingIds.push(first.bookingId)

    // A second call with the same key returns the prior booking
    // without invoking the handler again. The quote is already
    // consumed at this point, so reaching the handler would throw —
    // a successful return proves the short-circuit fired.
    const second = await bookEntity(
      db,
      { registry, ownedHandlers },
      {
        quoteId: quote.quoteId,
        idempotencyKey,
        adapterContext: { connection_id: "engine" },
      },
    )

    expect(second.bookingId).toBe(first.bookingId)
    expect(second.snapshotId).toBe(first.snapshotId)
  })

  it("falls through to the SourceAdapterRegistry when sourceKind != owned", async () => {
    const ownedHandlers = createOwnedBookingHandlerRegistry()
    // Register an owned handler so the seam is wired, but the
    // request below uses a different sourceKind so the engine should
    // route to the adapter registry instead.
    ownedHandlers.register(buildHandler())
    const registry = createSourceAdapterRegistry()

    await expect(
      quoteEntity(
        db,
        { registry, ownedHandlers },
        {
          entityModule: "products",
          entityId: "prod_test_4",
          sourceKind: "demo",
          scope: { locale: "en-GB", audience: "staff", market: "default" },
          adapterContext: { connection_id: "engine" },
        },
      ),
    ).rejects.toThrow(/no SourceAdapter registered/)
  })
})
