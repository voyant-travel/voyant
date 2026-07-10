import type { AnyDrizzleDb } from "@voyant-travel/db"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import type { RunActionLedgerCanaryResult } from "../../src/canary.js"
import {
  type ActionLedgerDriftCheckResult,
  type ActionLedgerHealthResponse,
  createActionLedgerHealthHonoExtension,
  createActionLedgerHealthRoutes,
  runActionLedgerHealthCheck,
} from "../../src/health-routes.js"

const db = {} as AnyDrizzleDb

const okBookingDrift: ActionLedgerDriftCheckResult = {
  ok: true,
  rows: [{ check: "booking_confirmed", missingCount: 0, sampleIds: [] }],
}
const okFinanceDrift: ActionLedgerDriftCheckResult = {
  ok: true,
  rows: [{ check: "invoice", missingCount: 0, sampleIds: [] }],
}
const okProductDrift: ActionLedgerDriftCheckResult = {
  ok: true,
  rows: [{ check: "product", missingCount: 0, sampleIds: [] }],
}
const okCanary: RunActionLedgerCanaryResult = {
  ok: true,
  actionId: "alge_canary",
  replayed: false,
  observedWrite: true,
  observedRelay: true,
}

describe("action-ledger health runtime", () => {
  it("publishes a package-owned extension descriptor", () => {
    const checkDrift = vi.fn().mockResolvedValue(okBookingDrift)
    const extension = createActionLedgerHealthHonoExtension({
      checkBookingDrift: checkDrift,
      checkFinanceDrift: checkDrift,
      checkProductDrift: checkDrift,
    })

    expect(extension.extension).toEqual({ name: "action-ledger-health", module: "action-ledger" })
    expect(extension.adminRoutes).toBeDefined()
  })
})

describe("runActionLedgerHealthCheck", () => {
  it("combines booking, finance, product drift and canary health", async () => {
    const canary: RunActionLedgerCanaryResult = { ...okCanary }
    const checkBookingDrift = vi.fn().mockResolvedValue(okBookingDrift)
    const checkFinanceDrift = vi.fn().mockResolvedValue(okFinanceDrift)
    const checkProductDrift = vi.fn().mockResolvedValue(okProductDrift)
    const runCanaryCheck = vi.fn().mockResolvedValue(canary)

    await expect(
      runActionLedgerHealthCheck({
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
      bookingDrift: okBookingDrift,
      financeDrift: okFinanceDrift,
      productDrift: okProductDrift,
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
    const financeDrift: ActionLedgerDriftCheckResult = {
      ok: false,
      rows: [{ check: "payment", missingCount: 2, sampleIds: ["pay_2", "pay_1"] }],
    }
    const runCanaryCheck = vi.fn()

    await expect(
      runActionLedgerHealthCheck({
        db,
        drift: {},
        runCanary: false,
        checkBookingDrift: vi.fn().mockResolvedValue(okBookingDrift),
        checkFinanceDrift: vi.fn().mockResolvedValue(financeDrift),
        checkProductDrift: vi.fn().mockResolvedValue(okProductDrift),
        runCanaryCheck,
      }),
    ).resolves.toEqual({
      ok: false,
      canary: null,
      bookingDrift: okBookingDrift,
      financeDrift,
      productDrift: okProductDrift,
    })
    expect(runCanaryCheck).not.toHaveBeenCalled()
  })

  it("fails health when product drift is missing ledger entries", async () => {
    const productDrift: ActionLedgerDriftCheckResult = {
      ok: false,
      rows: [{ check: "product_media", missingCount: 1, sampleIds: ["pm_1"] }],
    }

    await expect(
      runActionLedgerHealthCheck({
        db,
        drift: {},
        runCanary: false,
        checkBookingDrift: vi.fn().mockResolvedValue(okBookingDrift),
        checkFinanceDrift: vi.fn().mockResolvedValue(okFinanceDrift),
        checkProductDrift: vi.fn().mockResolvedValue(productDrift),
      }),
    ).resolves.toMatchObject({
      ok: false,
      bookingDrift: okBookingDrift,
      financeDrift: okFinanceDrift,
      productDrift,
    })
  })

  it("fails health when booking drift is missing ledger entries", async () => {
    const bookingDrift: ActionLedgerDriftCheckResult = {
      ok: false,
      rows: [{ check: "booking_traveler_travel_details", missingCount: 1, sampleIds: ["bptr_1"] }],
    }

    await expect(
      runActionLedgerHealthCheck({
        db,
        drift: {},
        runCanary: false,
        checkBookingDrift: vi.fn().mockResolvedValue(bookingDrift),
        checkFinanceDrift: vi.fn().mockResolvedValue(okFinanceDrift),
        checkProductDrift: vi.fn().mockResolvedValue(okProductDrift),
      }),
    ).resolves.toMatchObject({
      ok: false,
      bookingDrift,
      financeDrift: okFinanceDrift,
      productDrift: okProductDrift,
    })
  })
})

describe("createActionLedgerHealthRoutes", () => {
  const mountApp = (overrides?: {
    checkBookingDrift?: ReturnType<typeof vi.fn>
    checkFinanceDrift?: ReturnType<typeof vi.fn>
    checkProductDrift?: ReturnType<typeof vi.fn>
    runCanaryCheck?: ReturnType<typeof vi.fn>
  }) => {
    const app = new Hono<{
      Variables: { db: AnyDrizzleDb; userId?: string; organizationId?: string }
    }>()
    app.use("*", async (c, next) => {
      c.set("db", db)
      await next()
    })
    app.route(
      "/v1/admin/action-ledger",
      createActionLedgerHealthRoutes({
        checkBookingDrift:
          overrides?.checkBookingDrift ?? vi.fn().mockResolvedValue(okBookingDrift),
        checkFinanceDrift:
          overrides?.checkFinanceDrift ?? vi.fn().mockResolvedValue(okFinanceDrift),
        checkProductDrift:
          overrides?.checkProductDrift ?? vi.fn().mockResolvedValue(okProductDrift),
        runCanaryCheck: overrides?.runCanaryCheck ?? vi.fn().mockResolvedValue(okCanary),
      }),
    )
    return app
  }

  it("serves the read-only health check at the mounted prefix (200, no canary)", async () => {
    const runCanaryCheck = vi.fn().mockResolvedValue(okCanary)
    const app = mountApp({ runCanaryCheck })
    const res = await app.request("/v1/admin/action-ledger/health")
    expect(res.status).toBe(200)
    const body = (await res.json()) as ActionLedgerHealthResponse
    expect(body.data.ok).toBe(true)
    expect(body.data.canary).toBeNull()
    expect(runCanaryCheck).not.toHaveBeenCalled()
  })

  it("serves the canary health check at the mounted prefix (200, canary written)", async () => {
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

  it("returns 503 when a drift check fails", async () => {
    const app = mountApp({
      checkFinanceDrift: vi.fn().mockResolvedValue({
        ok: false,
        rows: [{ check: "payment", missingCount: 1, sampleIds: ["pay_1"] }],
      }),
    })
    const res = await app.request("/v1/admin/action-ledger/health")
    expect(res.status).toBe(503)
    const body = (await res.json()) as ActionLedgerHealthResponse
    expect(body.data.ok).toBe(false)
  })
})
