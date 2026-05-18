import type { RunActionLedgerCanaryResult } from "@voyantjs/action-ledger/canary"
import type { CheckBookingActionLedgerDriftResult } from "@voyantjs/bookings/action-ledger-drift"
import type { AnyDrizzleDb } from "@voyantjs/db"
import type { CheckFinanceActionLedgerDriftResult } from "@voyantjs/finance/action-ledger-drift"
import type { CheckProductActionLedgerDriftResult } from "@voyantjs/products/action-ledger-drift"
import { describe, expect, it, vi } from "vitest"

import { runOperatorActionLedgerHealthCheck } from "./action-ledger-health.js"

const db = {} as AnyDrizzleDb

describe("runOperatorActionLedgerHealthCheck", () => {
  it("combines booking, finance, product drift and canary health", async () => {
    const bookingDrift: CheckBookingActionLedgerDriftResult = {
      ok: true,
      rows: [
        {
          check: "booking_confirmed",
          missingCount: 0,
          sampleIds: [],
        },
      ],
    }
    const financeDrift: CheckFinanceActionLedgerDriftResult = {
      ok: true,
      rows: [
        {
          check: "invoice",
          missingCount: 0,
          sampleIds: [],
        },
      ],
    }
    const canary: RunActionLedgerCanaryResult = {
      ok: true,
      actionId: "alge_canary",
      replayed: false,
      observedWrite: true,
      observedRelay: true,
    }
    const productDrift: CheckProductActionLedgerDriftResult = {
      ok: true,
      rows: [
        {
          check: "product",
          missingCount: 0,
          sampleIds: [],
        },
      ],
    }
    const checkBookingDrift = vi.fn().mockResolvedValue(bookingDrift)
    const checkFinanceDrift = vi.fn().mockResolvedValue(financeDrift)
    const checkProductDrift = vi.fn().mockResolvedValue(productDrift)
    const runCanaryCheck = vi.fn().mockResolvedValue(canary)

    await expect(
      runOperatorActionLedgerHealthCheck({
        db,
        drift: { createdAtFrom: "2026-05-17T00:00:00.000Z", sampleLimit: 5 },
        canary: { idempotencyKey: "canary-1" },
        runCanary: true,
        checkBookingDrift,
        checkFinanceDrift,
        checkProductDrift,
        runCanaryCheck,
      }),
    ).resolves.toEqual({
      ok: true,
      canary,
      bookingDrift,
      financeDrift,
      productDrift,
    })
    expect(checkBookingDrift).toHaveBeenCalledWith(db, {
      createdAtFrom: "2026-05-17T00:00:00.000Z",
      sampleLimit: 5,
    })
    expect(checkFinanceDrift).toHaveBeenCalledWith(db, {
      createdAtFrom: "2026-05-17T00:00:00.000Z",
      sampleLimit: 5,
    })
    expect(checkProductDrift).toHaveBeenCalledWith(db, {
      createdAtFrom: "2026-05-17T00:00:00.000Z",
      sampleLimit: 5,
    })
    expect(runCanaryCheck).toHaveBeenCalledWith(db, { idempotencyKey: "canary-1" })
  })

  it("keeps the read-only health path from writing a canary", async () => {
    const bookingDrift: CheckBookingActionLedgerDriftResult = {
      ok: true,
      rows: [{ check: "booking_traveler", missingCount: 0, sampleIds: [] }],
    }
    const financeDrift: CheckFinanceActionLedgerDriftResult = {
      ok: false,
      rows: [{ check: "payment", missingCount: 2, sampleIds: ["pay_2", "pay_1"] }],
    }
    const productDrift: CheckProductActionLedgerDriftResult = {
      ok: true,
      rows: [{ check: "product", missingCount: 0, sampleIds: [] }],
    }
    const runCanaryCheck = vi.fn()

    await expect(
      runOperatorActionLedgerHealthCheck({
        db,
        drift: {},
        runCanary: false,
        checkBookingDrift: vi.fn().mockResolvedValue(bookingDrift),
        checkFinanceDrift: vi.fn().mockResolvedValue(financeDrift),
        checkProductDrift: vi.fn().mockResolvedValue(productDrift),
        runCanaryCheck,
      }),
    ).resolves.toEqual({
      ok: false,
      canary: null,
      bookingDrift,
      financeDrift,
      productDrift,
    })
    expect(runCanaryCheck).not.toHaveBeenCalled()
  })

  it("fails health when product drift is missing ledger entries", async () => {
    const bookingDrift: CheckBookingActionLedgerDriftResult = {
      ok: true,
      rows: [{ check: "booking_completed", missingCount: 0, sampleIds: [] }],
    }
    const financeDrift: CheckFinanceActionLedgerDriftResult = {
      ok: true,
      rows: [{ check: "invoice", missingCount: 0, sampleIds: [] }],
    }
    const productDrift: CheckProductActionLedgerDriftResult = {
      ok: false,
      rows: [{ check: "product_media", missingCount: 1, sampleIds: ["pm_1"] }],
    }

    await expect(
      runOperatorActionLedgerHealthCheck({
        db,
        drift: {},
        runCanary: false,
        checkBookingDrift: vi.fn().mockResolvedValue(bookingDrift),
        checkFinanceDrift: vi.fn().mockResolvedValue(financeDrift),
        checkProductDrift: vi.fn().mockResolvedValue(productDrift),
      }),
    ).resolves.toMatchObject({
      ok: false,
      bookingDrift,
      financeDrift,
      productDrift,
    })
  })

  it("fails health when booking drift is missing ledger entries", async () => {
    const bookingDrift: CheckBookingActionLedgerDriftResult = {
      ok: false,
      rows: [{ check: "booking_traveler_travel_details", missingCount: 1, sampleIds: ["bptr_1"] }],
    }
    const financeDrift: CheckFinanceActionLedgerDriftResult = {
      ok: true,
      rows: [{ check: "invoice", missingCount: 0, sampleIds: [] }],
    }
    const productDrift: CheckProductActionLedgerDriftResult = {
      ok: true,
      rows: [{ check: "product", missingCount: 0, sampleIds: [] }],
    }

    await expect(
      runOperatorActionLedgerHealthCheck({
        db,
        drift: {},
        runCanary: false,
        checkBookingDrift: vi.fn().mockResolvedValue(bookingDrift),
        checkFinanceDrift: vi.fn().mockResolvedValue(financeDrift),
        checkProductDrift: vi.fn().mockResolvedValue(productDrift),
      }),
    ).resolves.toMatchObject({
      ok: false,
      bookingDrift,
      financeDrift,
      productDrift,
    })
  })
})
