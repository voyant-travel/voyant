import { runVoucherSetupMigration } from "@voyant-travel/finance/setup/vouchers"

import type { VoyantProjectMigrationPlan } from "@voyant-travel/framework/project"
import { describe, expect, it } from "vitest"
import { createSetupLoaders } from "./migrate"

describe("operator graph migration runner", () => {
  it("loads the finance voucher setup handler from its admitted package export", async () => {
    const plan: VoyantProjectMigrationPlan = {
      schemaVersion: "voyant.migration-plan.v1",
      contentHash: `sha256:${"a".repeat(64)}`,
      migrations: [
        {
          id: "@voyant-travel/finance#setup.vouchers-from-payment-instruments.v1",
          migrationKind: "setup",
          order: 0,
          idempotencyKey: "setup:@voyant-travel/finance#setup.vouchers-from-payment-instruments.v1",
          owner: "@voyant-travel/finance",
          packageName: "@voyant-travel/finance",
          source: "@voyant-travel/finance/setup/vouchers",
          runtime: {
            entry: "@voyant-travel/finance/setup/vouchers",
            export: "runVoucherSetupMigration",
          },
          dependsOn: [],
        },
      ],
    }

    const handler =
      await createSetupLoaders(plan)[
        "@voyant-travel/finance#setup.vouchers-from-payment-instruments.v1"
      ]?.()

    expect(handler).toBe(runVoucherSetupMigration)
  })
})
