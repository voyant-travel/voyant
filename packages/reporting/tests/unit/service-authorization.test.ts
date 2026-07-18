import { describe, expect, it } from "vitest"

import { ReportingAuthorizationError, ReportingRegistry } from "../../src/registry.js"
import { createReportingService } from "../../src/service.js"

function databaseReturning(run: unknown) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [run] }),
      }),
    }),
  }
}

describe("report run authorization", () => {
  it("rechecks source scopes before returning persisted results to another reader", async () => {
    const service = createReportingService(new ReportingRegistry([]))
    const run = {
      id: "run_1",
      output: {
        widgets: [
          {
            widgetInstanceId: "receivables",
            status: "succeeded",
            datasetId: "finance.receivables",
            datasetVersion: 1,
            requiredScopes: ["finance:read"],
            result: { columns: [], rows: [], truncated: false, warnings: [] },
          },
        ],
      },
    }

    await expect(
      service.getRun(databaseReturning(run) as never, run.id, ["reports:export"]),
    ).rejects.toThrow(ReportingAuthorizationError)
    await expect(
      service.getRun(databaseReturning(run) as never, run.id, ["reports:export", "finance:read"]),
    ).resolves.toBe(run)
  })
})
