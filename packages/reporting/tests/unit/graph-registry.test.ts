import type { VoyantGraphReportingCatalog } from "@voyant-travel/core/project"
import { describe, expect, it, vi } from "vitest"

import { createReportingRegistryFromGraph, ReportingRegistryError } from "../../src/index.js"

const datasetId = "@acme/finance#reporting.dataset.revenue"
const datasetReferenceId =
  "%40acme%2Ffinance/reporting.datasets.runtime/%40acme%2Ffinance%23reporting.dataset.revenue"
const widgetId = "@acme/finance#reporting.widget.monthly-revenue"
const missingWidgetId = "@acme/finance#reporting.widget.missing"

const catalog = {
  datasets: [
    {
      id: datasetId,
      ownerUnitId: "@acme/finance",
      runtimeReferenceId: datasetReferenceId,
      version: 1,
      label: "Revenue",
      descriptor: {
        grain: "One row per invoice",
        fields: [
          {
            id: "gross",
            label: "Gross",
            role: "measure",
            valueType: "currency",
            aggregations: ["sum"],
          },
        ],
      },
      runtime: { entry: "@acme/finance/reporting", export: "revenueDataset" },
      requiredScopes: ["finance:read"],
    },
  ],
  widgets: [
    {
      id: widgetId,
      ownerUnitId: "@acme/finance",
      version: 1,
      label: "Monthly revenue",
      datasetId,
      query: {
        select: [{ kind: "aggregate", operation: "sum", field: "gross", as: "gross" }],
      },
      visualization: { type: "kpi" },
      defaultSize: { width: 3, height: 2 },
      available: true,
      missingRequirements: [],
    },
    {
      id: missingWidgetId,
      ownerUnitId: "@acme/finance",
      version: 1,
      label: "Missing source",
      datasetId: "@acme/missing#reporting.dataset.source",
      query: { select: [{ kind: "aggregate", operation: "count", as: "rows" }] },
      visualization: { type: "kpi" },
      defaultSize: { width: 3, height: 2 },
      available: false,
      missingRequirements: [{ kind: "dataset", id: "@acme/missing#reporting.dataset.source" }],
    },
  ],
  templates: [
    {
      id: "@acme/finance#reporting.template.overview",
      ownerUnitId: "@acme/finance",
      version: 1,
      label: "Overview",
      widgets: [
        {
          id: "revenue",
          widgetId,
          layout: { x: 0, y: 0, width: 3, height: 2 },
        },
        {
          id: "missing",
          widgetId: missingWidgetId,
          layout: { x: 3, y: 0, width: 3, height: 2 },
        },
      ],
      available: false,
      missingRequirements: [{ kind: "widget", id: missingWidgetId }],
    },
  ],
} as const satisfies VoyantGraphReportingCatalog

describe("createReportingRegistryFromGraph", () => {
  it("loads manifest datasets and normalizes presets and page templates", async () => {
    const execute = vi.fn(async () => ({
      columns: [{ id: "gross", label: "Gross", valueType: "currency" as const }],
      rows: [{ gross: 1200 }],
      truncated: false,
      warnings: [],
    }))
    const load = vi.fn(async () => ({ execute }))
    const registry = await createReportingRegistryFromGraph({
      graph: {
        reportingCatalog: catalog,
        references: [
          {
            id: datasetReferenceId,
            unitId: "@acme/finance",
            facet: "reporting.datasets.runtime",
            entityId: datasetId,
            importEntry: "@acme/finance/reporting",
            load,
            loadModule: vi.fn(),
          },
        ],
      },
    })

    expect(load).toHaveBeenCalledOnce()
    expect(registry.getWidget(widgetId)).toMatchObject({
      query: { dataset: { id: datasetId } },
      minimumSize: undefined,
    })
    expect(registry.getTemplate("@acme/finance#reporting.template.overview")?.widgets).toHaveLength(
      2,
    )

    await expect(
      registry.executeQuery({
        db: {},
        grantedScopes: ["finance:read"],
        query: {
          dataset: { id: datasetId },
          select: [{ kind: "aggregate", operation: "sum", field: "gross", as: "gross" }],
          filters: [],
          groupBy: [],
          orderBy: [],
        },
      }),
    ).resolves.toMatchObject({ rows: [{ gross: 1200 }] })

    const template = registry.getTemplate("@acme/finance#reporting.template.overview")!
    const draft = { parameters: {}, widgets: template.widgets }
    expect(registry.resolveDraft(draft, "view").map(({ instance }) => instance.id)).toEqual([
      "revenue",
    ])
    expect(registry.resolveDraft(draft, "edit").map(({ status }) => status)).toEqual([
      "available",
      "missing",
    ])
  })

  it("rejects a dataset runtime export which does not implement execute", async () => {
    await expect(
      createReportingRegistryFromGraph({
        graph: {
          reportingCatalog: catalog,
          references: [
            {
              id: datasetReferenceId,
              unitId: "@acme/finance",
              facet: "reporting.datasets.runtime",
              entityId: datasetId,
              importEntry: "@acme/finance/reporting",
              load: async () => ({ wrong: true }),
              loadModule: vi.fn(),
            },
          ],
        },
      }),
    ).rejects.toThrow(ReportingRegistryError)
  })
})
