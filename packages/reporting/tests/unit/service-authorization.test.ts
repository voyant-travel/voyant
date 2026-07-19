import { describe, expect, it } from "vitest"

import { ReportingRegistry } from "../../src/registry.js"
import { createReportingService } from "../../src/service.js"

const reportDefinition = {
  id: "rpdf_export_auth",
  name: "Receivables",
  description: null,
  draft: {
    parameters: {},
    widgets: [
      {
        id: "w1",
        source: {
          kind: "custom" as const,
          definition: {
            id: "custom-1",
            version: 1,
            label: "Invoice count",
            query: {
              dataset: { id: "finance.receivables", version: 1 },
              select: [{ kind: "aggregate", operation: "count", as: "n" }],
              filters: [],
              groupBy: [],
              orderBy: [],
            },
            visualization: { type: "kpi", options: {} },
            defaultSize: { width: 4, height: 2 },
          },
        },
        layout: { x: 0, y: 0, width: 4, height: 2 },
      },
    ],
  },
}

/** Mocks the single-row `select().from().where().limit()` lookup exportReport does. */
function databaseReturning(row: unknown) {
  return {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [row] }) }) }),
  }
}

function financeRegistry() {
  return new ReportingRegistry([
    {
      namespace: "finance",
      datasets: [
        {
          definition: {
            id: "finance.receivables",
            version: 1,
            label: "Receivables",
            grain: "One row per invoice",
            requiredScopes: ["finance:read"],
            fields: [
              {
                id: "status",
                label: "Status",
                role: "dimension",
                valueType: "string",
                sensitivity: "internal",
                requiredScopes: [],
                aggregations: [],
              },
            ],
            defaultLimit: 100,
            maximumLimit: 1_000,
          },
          execute: async () => ({
            columns: [{ id: "n", label: "Count", valueType: "integer" }],
            rows: [{ n: 3 }],
            truncated: false,
            warnings: [],
          }),
        },
      ],
    },
  ])
}

describe("report export authorization", () => {
  it("returns an error section (never data) for widgets whose source scopes the reader lacks", async () => {
    const service = createReportingService(financeRegistry())
    const report = await service.exportReport(
      databaseReturning(reportDefinition) as never,
      reportDefinition.id,
      {},
      { grantedScopes: ["reports:export"] },
    )
    expect(report?.sections).toHaveLength(1)
    expect(report?.sections[0]?.error).toBeTruthy()
    expect(report?.sections[0]?.rows).toHaveLength(0)
  })

  it("returns the widget data when the reader holds every source scope", async () => {
    const service = createReportingService(financeRegistry())
    const report = await service.exportReport(
      databaseReturning(reportDefinition) as never,
      reportDefinition.id,
      {},
      { grantedScopes: ["reports:export", "finance:read"] },
    )
    expect(report?.sections[0]?.error).toBeUndefined()
    expect(report?.sections[0]?.rows).toEqual([{ n: 3 }])
  })
})
