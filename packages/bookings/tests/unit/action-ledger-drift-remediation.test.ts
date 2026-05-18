import { describe, expect, it } from "vitest"

import { buildBookingActionLedgerDriftRemediationPlan } from "../../src/action-ledger-drift-remediation.js"

describe("booking action ledger drift remediation", () => {
  it("builds a dry-run plan for missing booking ledger entries", () => {
    const plan = buildBookingActionLedgerDriftRemediationPlan({
      generatedAt: "2026-05-17T12:00:00.000Z",
      createdAtFrom: "2026-05-01T00:00:00.000Z",
      sampleLimit: 2,
      drift: {
        ok: false,
        rows: [
          {
            check: "booking_item",
            missingCount: 3,
            sampleIds: ["bkit_2", "bkit_1"],
          },
          {
            check: "booking_confirmed",
            missingCount: 0,
            sampleIds: [],
          },
        ],
      },
    })

    expect(plan).toMatchObject({
      mode: "dry_run",
      generatedAt: "2026-05-17T12:00:00.000Z",
      createdAtFrom: "2026-05-01T00:00:00.000Z",
      sampleLimit: 2,
      totalMissingCount: 3,
      items: [
        {
          check: "booking_item",
          missingCount: 3,
          sampleTargetIds: ["bkit_2", "bkit_1"],
          sampleTruncated: true,
          recommendedBackfillActionName: "booking.item.create",
          targetType: "booking_item",
          targetIdKind: "booking_item_id",
          mode: "dry_run",
        },
      ],
    })
  })

  it("rejects invalid dates", () => {
    expect(() =>
      buildBookingActionLedgerDriftRemediationPlan({
        generatedAt: "not-a-date",
        drift: { ok: true, rows: [] },
      }),
    ).toThrow("generatedAt must be a valid date")

    expect(() =>
      buildBookingActionLedgerDriftRemediationPlan({
        createdAtFrom: "not-a-date",
        drift: { ok: true, rows: [] },
      }),
    ).toThrow("createdAtFrom must be a valid date")
  })
})
