import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import { __test__, buildBookingActionLedgerDriftQueries } from "../../src/action-ledger-drift.js"

describe("booking action ledger drift checks", () => {
  it("builds drift queries for timestamped booking status transitions", () => {
    const queries = buildBookingActionLedgerDriftQueries({
      createdAtFrom: "2026-05-17T00:00:00.000Z",
      sampleLimit: 5,
    })
    const dialect = new PgDialect()
    const confirmed = dialect.sqlToQuery(queries.booking_confirmed)
    const expired = dialect.sqlToQuery(queries.booking_expired)
    const cancelled = dialect.sqlToQuery(queries.booking_cancelled)
    const completed = dialect.sqlToQuery(queries.booking_completed)

    expect(confirmed.sql).toContain('"bookings"')
    expect(confirmed.sql).toContain('"action_ledger_entries"')
    expect(confirmed.sql).toContain('"bookings"."confirmed_at" IS NOT NULL')
    expect(confirmed.sql).toContain('"bookings"."confirmed_at" >= ')
    expect(confirmed.params).toEqual(
      expect.arrayContaining(["booking_confirmed", "booking.status.confirm", "booking"]),
    )

    expect(expired.sql).toContain('"bookings"."expired_at" IS NOT NULL')
    expect(expired.params).toEqual(
      expect.arrayContaining(["booking_expired", "booking.status.expire", "booking"]),
    )

    expect(cancelled.sql).toContain('"bookings"."cancelled_at" IS NOT NULL')
    expect(cancelled.params).toEqual(
      expect.arrayContaining(["booking_cancelled", "booking.status.cancel", "booking"]),
    )

    expect(completed.sql).toContain('"bookings"."completed_at" IS NOT NULL')
    expect(completed.params).toEqual(
      expect.arrayContaining(["booking_completed", "booking.status.complete", "booking"]),
    )
  })

  it("builds drift queries for booking travelers and travel details", () => {
    const queries = buildBookingActionLedgerDriftQueries({ sampleLimit: 2 })
    const dialect = new PgDialect()
    const traveler = dialect.sqlToQuery(queries.booking_traveler)
    const travelDetails = dialect.sqlToQuery(queries.booking_traveler_travel_details)

    expect(traveler.sql).toContain('"booking_travelers"')
    expect(traveler.params).toEqual(
      expect.arrayContaining([
        "booking.traveler.create",
        "booking.traveler_with_travel_details.create",
        "booking_traveler",
      ]),
    )

    expect(travelDetails.sql).toContain('"booking_traveler_travel_details"')
    expect(travelDetails.sql).toContain('"booking_traveler_travel_details"."traveler_id"')
    expect(travelDetails.params).toEqual(
      expect.arrayContaining([
        "booking.traveler_with_travel_details.create",
        "booking.traveler_travel_details.update",
        "booking_traveler",
      ]),
    )
  })

  it("clamps the sample limit and normalizes rows", () => {
    const query = new PgDialect().sqlToQuery(
      buildBookingActionLedgerDriftQueries({ sampleLimit: 999 }).booking_confirmed,
    )

    expect(query.params).toContain(100)
    expect(
      __test__.normalizeRow({
        check: "booking_traveler",
        missing_count: "2",
        sample_ids: ["bptr_2", "bptr_1"],
      }),
    ).toEqual({
      check: "booking_traveler",
      missingCount: 2,
      sampleIds: ["bptr_2", "bptr_1"],
    })
  })

  it("rejects invalid createdAtFrom values while building queries", () => {
    expect(() => buildBookingActionLedgerDriftQueries({ createdAtFrom: "not-a-date" })).toThrow(
      "createdAtFrom must be a valid date",
    )
  })
})
