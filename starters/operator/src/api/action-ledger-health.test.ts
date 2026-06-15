import type { RunActionLedgerCanaryResult } from "@voyant-travel/action-ledger/canary"
import type { CheckBookingActionLedgerDriftResult } from "@voyant-travel/bookings/action-ledger-drift"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { CheckFinanceActionLedgerDriftResult } from "@voyant-travel/finance/action-ledger-drift"
import type { CheckProductActionLedgerDriftResult } from "@voyant-travel/inventory/action-ledger-drift"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import {
  type ActionLedgerHealthResponse,
  createActionLedgerHealthAdminRoutes,
  runOperatorActionLedgerHealthCheck,
} from "./action-ledger-health.js"

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

vi.mock("@voyant-travel/bookings/action-ledger-drift", () => ({
  checkBookingActionLedgerDrift: vi.fn().mockResolvedValue({
    ok: true,
    rows: [{ check: "booking", missingCount: 0, sampleIds: [] }],
  }),
}))

vi.mock("@voyant-travel/finance/action-ledger-drift", () => ({
  checkFinanceActionLedgerDrift: vi.fn().mockResolvedValue({
    ok: true,
    rows: [{ check: "invoice", missingCount: 0, sampleIds: [] }],
  }),
}))

vi.mock("@voyant-travel/inventory/action-ledger-drift", () => ({
  checkProductActionLedgerDrift: vi.fn().mockResolvedValue({
    ok: true,
    rows: [{ check: "product", missingCount: 0, sampleIds: [] }],
  }),
}))

vi.mock("@voyant-travel/action-ledger/canary", () => ({
  runActionLedgerCanary: vi.fn().mockResolvedValue({
    ok: true,
    actionId: "alge_canary",
    replayed: false,
    observedWrite: true,
    observedRelay: true,
  }),
}))

describe("createActionLedgerHealthAdminRoutes", () => {
  const mountApp = () => {
    const app = new Hono<{
      Variables: { db: AnyDrizzleDb; userId?: string; organizationId?: string }
    }>()
    app.use("*", async (c, next) => {
      c.set("db", db)
      await next()
    })
    app.route("/v1/admin/action-ledger", createActionLedgerHealthAdminRoutes())
    return app
  }

  it("serves the read-only health check at the mounted prefix", async () => {
    const app = mountApp()
    const res = await app.request("/v1/admin/action-ledger/health")
    expect(res.status).toBe(200)
    const body = (await res.json()) as ActionLedgerHealthResponse
    expect(body.data.ok).toBe(true)
    expect(body.data.canary).toBeNull()
  })

  it("serves the canary health check at the mounted prefix", async () => {
    const app = mountApp()
    const res = await app.request("/v1/admin/action-ledger/health/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as ActionLedgerHealthResponse
    expect(body.data.ok).toBe(true)
    expect(body.data.canary?.actionId).toBe("alge_canary")
  })
})
