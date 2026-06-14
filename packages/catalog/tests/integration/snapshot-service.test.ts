/**
 * Integration tests for SnapshotService — exercises the booking snapshot
 * graph capture/read path against a real Postgres test database.
 *
 * Skips locally if `TEST_DATABASE_URL` is unset or the connection fails.
 */

import { newId } from "@voyant-travel/db/lib/typeid"
import { createTestDb } from "@voyant-travel/db/test-utils"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import {
  captureSnapshot,
  captureSnapshotGraph,
  fetchEntitySnapshot,
  fetchSnapshotsForBooking,
} from "../../src/services/snapshot-service.js"
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

describe.skipIf(!DB_AVAILABLE)("SnapshotService integration", () => {
  let db: PostgresJsDatabase

  beforeAll(() => {
    db = createTestDb()
  })

  let createdBookingIds: string[] = []

  afterEach(async () => {
    for (const bookingId of createdBookingIds) {
      await db
        .delete(bookingCatalogSnapshotTable)
        .where(eq(bookingCatalogSnapshotTable.booking_id, bookingId))
    }
    createdBookingIds = []
  })

  afterAll(async () => {
    // Defensive sweep
  })

  it("captureSnapshot writes a single row and fetchEntitySnapshot reads it back", async () => {
    const bookingId = newId("bookings" as never)
    createdBookingIds.push(bookingId)

    const row = await captureSnapshot(db, {
      bookingId,
      entityModule: "products",
      entityId: "prod_xyz",
      sourceKind: "owned",
      frozenPayload: { title: "Bali Wellness", description: "Source description" },
      overlayStateAtCapture: {
        title: { locale: "en-GB", audience: "customer", market: "default" },
      },
      pricingBasis: {
        base_amount: 1000,
        taxes: 100,
        fees: 50,
        surcharges: 0,
        currency: "EUR",
      },
    })

    expect(row.id).toBeTruthy()
    expect(row.booking_id).toBe(bookingId)
    expect(row.entity_module).toBe("products")
    expect(row.entity_id).toBe("prod_xyz")
    expect(row.source_kind).toBe("owned")
    expect(row.pricing_currency).toBe("EUR")
    expect(Number(row.pricing_base_amount)).toBe(1000)

    const fetched = await fetchEntitySnapshot(db, bookingId, "products", "prod_xyz")
    expect(fetched).not.toBeNull()
    expect(fetched?.id).toBe(row.id)
    expect(fetched?.frozen_payload).toEqual({
      title: "Bali Wellness",
      description: "Source description",
    })
  })

  it("captureSnapshotGraph writes multiple rows in one call", async () => {
    const bookingId = newId("bookings" as never)
    createdBookingIds.push(bookingId)

    const rows = await captureSnapshotGraph(db, bookingId, [
      {
        entityModule: "products",
        entityId: "prod_pkg",
        sourceKind: "owned",
        frozenPayload: { title: "TUI Package" },
      },
      {
        entityModule: "accommodations",
        entityId: "rmtp_garden",
        sourceKind: "voyant-connect",
        sourceRef: "hb_room_12345",
        frozenPayload: { name: "Family Garden View" },
      },
      {
        entityModule: "extras",
        entityId: "pext_transfer",
        sourceKind: "owned",
        frozenPayload: { name: "Private Airport Transfer" },
      },
    ])

    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.entity_module).sort()).toEqual([
      "accommodations",
      "extras",
      "products",
    ])

    const allForBooking = await fetchSnapshotsForBooking(db, bookingId)
    expect(allForBooking).toHaveLength(3)
  })

  it("fetchEntitySnapshot returns null when no snapshot exists", async () => {
    const result = await fetchEntitySnapshot(db, "nonexistent_booking", "products", "prod_phantom")
    expect(result).toBeNull()
  })

  it("captureSnapshot rejects re-capturing the same (bookingId, entityModule, entityId)", async () => {
    const bookingId = newId("bookings" as never)
    createdBookingIds.push(bookingId)

    await captureSnapshot(db, {
      bookingId,
      entityModule: "products",
      entityId: "prod_xyz",
      sourceKind: "owned",
      frozenPayload: { title: "First" },
    })

    // Same (booking, entity_module, entity_id) — should fail the unique
    // constraint. Re-capturing the same entity is a logic bug.
    await expect(
      captureSnapshot(db, {
        bookingId,
        entityModule: "products",
        entityId: "prod_xyz",
        sourceKind: "owned",
        frozenPayload: { title: "Second" },
      }),
    ).rejects.toThrow()
  })

  it("captureSnapshotGraph is atomic — failure in one row rolls back all rows", async () => {
    const bookingId = newId("bookings" as never)
    createdBookingIds.push(bookingId)

    // Pre-write one snapshot. The graph below will conflict on entity prod_xyz.
    await captureSnapshot(db, {
      bookingId,
      entityModule: "products",
      entityId: "prod_xyz",
      sourceKind: "owned",
      frozenPayload: { title: "Pre-existing" },
    })

    await expect(
      captureSnapshotGraph(db, bookingId, [
        {
          entityModule: "accommodations",
          entityId: "rmtp_new",
          sourceKind: "owned",
          frozenPayload: {},
        },
        {
          // Conflict — same (booking, products, prod_xyz) as the row above
          entityModule: "products",
          entityId: "prod_xyz",
          sourceKind: "owned",
          frozenPayload: {},
        },
      ]),
    ).rejects.toThrow()

    // Confirm the partial write rolled back: rmtp_new should not be present.
    const all = await fetchSnapshotsForBooking(db, bookingId)
    expect(all).toHaveLength(1)
    expect(all[0]?.entity_id).toBe("prod_xyz")
  })

  it("captures readPricingBasis-compatible structured pricing columns", async () => {
    const bookingId = newId("bookings" as never)
    createdBookingIds.push(bookingId)

    const row = await captureSnapshot(db, {
      bookingId,
      entityModule: "cruises",
      entityId: "crse_abc",
      sourceKind: "voyant-connect",
      sourceConnectionId: "conn_viking",
      sourceRef: "WAVE2026-RHN-15D",
      frozenPayload: { name: "Rhine Discovery" },
      pricingBasis: {
        base_amount: 3499,
        taxes: 450,
        fees: 100,
        surcharges: 0,
        currency: "EUR",
        breakdown: { cabin_supplement: 200 },
      },
    })

    expect(Number(row.pricing_base_amount)).toBe(3499)
    expect(Number(row.pricing_taxes)).toBe(450)
    expect(row.pricing_currency).toBe("EUR")
    expect(row.pricing_breakdown).toEqual({ cabin_supplement: 200 })
    expect(row.source_connection_id).toBe("conn_viking")
    expect(row.source_ref).toBe("WAVE2026-RHN-15D")
  })
})
