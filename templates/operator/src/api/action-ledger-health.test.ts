import type { RunActionLedgerCanaryResult } from "@voyantjs/action-ledger/canary"
import type { AnyDrizzleDb } from "@voyantjs/db"
import type { CheckFinanceActionLedgerDriftResult } from "@voyantjs/finance/action-ledger-drift"
import { describe, expect, it, vi } from "vitest"

import { runOperatorActionLedgerHealthCheck } from "./action-ledger-health.js"

const db = {} as AnyDrizzleDb

describe("runOperatorActionLedgerHealthCheck", () => {
  it("combines finance drift and canary health", async () => {
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
    const checkFinanceDrift = vi.fn().mockResolvedValue(financeDrift)
    const runCanaryCheck = vi.fn().mockResolvedValue(canary)

    await expect(
      runOperatorActionLedgerHealthCheck({
        db,
        drift: { createdAtFrom: "2026-05-17T00:00:00.000Z", sampleLimit: 5 },
        canary: { idempotencyKey: "canary-1" },
        runCanary: true,
        checkFinanceDrift,
        runCanaryCheck,
      }),
    ).resolves.toEqual({
      ok: true,
      canary,
      financeDrift,
    })
    expect(checkFinanceDrift).toHaveBeenCalledWith(db, {
      createdAtFrom: "2026-05-17T00:00:00.000Z",
      sampleLimit: 5,
    })
    expect(runCanaryCheck).toHaveBeenCalledWith(db, { idempotencyKey: "canary-1" })
  })

  it("keeps the read-only health path from writing a canary", async () => {
    const financeDrift: CheckFinanceActionLedgerDriftResult = {
      ok: false,
      rows: [{ check: "payment", missingCount: 2, sampleIds: ["pay_2", "pay_1"] }],
    }
    const runCanaryCheck = vi.fn()

    await expect(
      runOperatorActionLedgerHealthCheck({
        db,
        drift: {},
        runCanary: false,
        checkFinanceDrift: vi.fn().mockResolvedValue(financeDrift),
        runCanaryCheck,
      }),
    ).resolves.toEqual({
      ok: false,
      canary: null,
      financeDrift,
    })
    expect(runCanaryCheck).not.toHaveBeenCalled()
  })
})
