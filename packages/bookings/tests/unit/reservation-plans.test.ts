import { describe, expect, it, vi } from "vitest"

import { submitBookingReservationPlan } from "../../src/reservation-plans.js"

describe("booking reservation plans", () => {
  it("reserves plan lines in order and reports held refs", async () => {
    const reserveCatalogBackedLine = vi.fn(async ({ line }) => ({
      status: "held" as const,
      bookingId: `book_${line.componentId}`,
      bookingGroupId: "bkgrp_123",
      holdToken: `hold_${line.componentId}`,
    }))

    const result = await submitBookingReservationPlan(
      {
        reservationPlanId: "trpl_123",
        envelope: { id: "trip_123" },
        lines: [
          { planLineId: "trcp_1", componentId: "trcp_1", kind: "catalog_backed", line: {} },
          { planLineId: "trcp_2", componentId: "trcp_2", kind: "catalog_backed", line: {} },
        ],
      },
      { reserveCatalogBackedLine },
    )

    expect(result).toMatchObject({
      reservationPlanId: "trpl_123",
      status: "reserved",
      failures: [],
      compensations: [],
      reserved: [
        { componentId: "trcp_1", status: "held" },
        { componentId: "trcp_2", status: "held" },
      ],
    })
    expect(reserveCatalogBackedLine.mock.calls.map(([input]) => input.line.componentId)).toEqual([
      "trcp_1",
      "trcp_2",
    ])
  })

  it("compensates already reserved lines when a later line fails", async () => {
    const releaseReservedLine = vi.fn(async () => ({ released: true }))

    const result = await submitBookingReservationPlan(
      {
        reservationPlanId: "trpl_123",
        envelope: { id: "trip_123" },
        lines: [
          { planLineId: "trcp_1", componentId: "trcp_1", kind: "catalog_backed", line: {} },
          { planLineId: "trcp_2", componentId: "trcp_2", kind: "catalog_backed", line: {} },
        ],
      },
      {
        reserveCatalogBackedLine: async ({ line }) => {
          if (line.componentId === "trcp_2") throw new Error("supplier_hold_failed")
          return { status: "held", bookingId: `book_${line.componentId}` }
        },
        releaseReservedLine,
      },
    )

    expect(result).toMatchObject({
      status: "failed",
      failures: [{ componentId: "trcp_2", reason: "supplier_hold_failed" }],
      compensations: [{ componentId: "trcp_1", status: "released" }],
    })
    expect(releaseReservedLine).toHaveBeenCalledOnce()
  })

  it("treats manual lines without a runtime adapter as internal holds", async () => {
    const result = await submitBookingReservationPlan(
      {
        reservationPlanId: "trpl_123",
        envelope: { id: "trip_123" },
        lines: [
          {
            planLineId: "trcp_manual",
            componentId: "trcp_manual",
            kind: "manual_placeholder",
            line: {},
          },
        ],
      },
      {
        reserveCatalogBackedLine: async () => {
          throw new Error("unexpected_catalog_reserve")
        },
      },
    )

    expect(result.reserved).toEqual([
      {
        planLineId: "trcp_manual",
        componentId: "trcp_manual",
        status: "held",
        result: { status: "held" },
      },
    ])
  })
})
