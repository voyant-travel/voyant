import { describe, expect, it } from "vitest"

import { buildDeploymentGraphJson, buildGraphRuntimeModule } from "./deployment-artifacts.js"
import {
  defineModule,
  defineProject,
  resolveDeploymentGraph,
  type VoyantGraphUnitManifest,
} from "./deployment-graph.js"

const revenueDataset = {
  id: "@acme/finance#reporting.dataset.revenue",
  version: 1,
  label: "Revenue",
  descriptor: {
    grain: "invoice",
    fields: [
      {
        id: "issued-at",
        label: "Issued at",
        role: "dimension",
        valueType: "date",
        aggregations: [],
      },
      {
        id: "gross",
        label: "Gross",
        role: "measure",
        valueType: "currency",
        aggregations: ["sum"],
      },
    ],
  },
  runtime: {
    entry: "@acme/finance/reporting-runtime-body-must-stay-lazy",
    export: "createRevenueDataset",
  },
} as const

const revenueWidget = {
  id: "@acme/finance#reporting.widget.monthly-revenue",
  version: 1,
  label: "Monthly revenue",
  datasetId: revenueDataset.id,
  query: {
    select: [
      { kind: "field", field: "issued-at" },
      { kind: "aggregate", operation: "sum", field: "gross", as: "gross" },
    ],
    groupBy: [{ field: "issued-at", timeGrain: "month" }],
  },
  visualization: { type: "line" },
  defaultSize: { width: 6, height: 4 },
  minSize: { width: 4, height: 3 },
} as const

const finance = defineModule({
  id: "@acme/finance",
  reporting: { datasets: [revenueDataset], widgets: [revenueWidget] },
})

const overview = defineModule({
  id: "@acme/operator-overview",
  reporting: {
    templates: [
      {
        id: "@acme/operator-overview#reporting.template.executive",
        version: 1,
        label: "Executive overview",
        requirements: [{ kind: "dataset", id: revenueDataset.id }],
        widgets: [
          {
            id: "monthly-revenue",
            widgetId: revenueWidget.id,
            layout: { x: 0, y: 0, width: 6, height: 4 },
          },
        ],
      },
    ],
  },
})

async function graphFor(units: readonly VoyantGraphUnitManifest[]) {
  return resolveDeploymentGraph({
    project: defineProject({ modules: units }),
    target: "node",
    mode: "self-hosted",
    packageRecords: [...new Set(units.map((unit) => unit.packageName ?? unit.id.split("#")[0]))]
      .filter((packageName): packageName is string => Boolean(packageName))
      .map((packageName) => ({ packageName, source: { kind: "workspace" as const } })),
  })
}

describe("reporting graph contributions", () => {
  it("composes datasets, widgets, and cross-module templates deterministically", async () => {
    const first = await graphFor([overview, finance])
    const second = await graphFor([finance, overview])

    expect(first.reportingCatalog).toEqual(second.reportingCatalog)
    expect(first.contentHash).toBe(second.contentHash)
    expect(first.reportingCatalog.datasets).toEqual([
      expect.objectContaining({
        id: revenueDataset.id,
        ownerUnitId: "@acme/finance",
        runtimeReferenceId:
          "%40acme%2Ffinance/reporting.datasets.runtime/%40acme%2Ffinance%23reporting.dataset.revenue",
      }),
    ])
    expect(first.reportingCatalog.widgets).toEqual([
      expect.objectContaining({
        id: revenueWidget.id,
        ownerUnitId: "@acme/finance",
        available: true,
        missingRequirements: [],
      }),
    ])
    expect(first.reportingCatalog.templates).toEqual([
      expect.objectContaining({
        id: "@acme/operator-overview#reporting.template.executive",
        ownerUnitId: "@acme/operator-overview",
        available: true,
        missingRequirements: [],
      }),
    ])
  })

  it("retains unavailable presets and templates without making the deployment invalid", async () => {
    const graph = await graphFor([
      defineModule({
        id: "@acme/operator-overview",
        reporting: {
          widgets: [revenueWidget],
          templates: overview.reporting?.templates,
        },
      }),
    ])

    expect(graph.diagnostics).toEqual([])
    expect(graph.reportingCatalog.widgets[0]).toMatchObject({
      available: false,
      missingRequirements: [{ kind: "dataset", id: revenueDataset.id }],
    })
    expect(graph.reportingCatalog.templates[0]).toMatchObject({
      available: false,
      missingRequirements: [
        { kind: "dataset", id: revenueDataset.id },
        { kind: "widget", id: revenueWidget.id },
      ],
    })
  })

  it("reports conflicting reporting identities through stable graph diagnostics", async () => {
    const graph = await graphFor([
      finance,
      defineModule({
        id: "@acme/finance-alternative",
        reporting: {
          datasets: [
            {
              ...revenueDataset,
              runtime: {
                entry: "@acme/finance-alternative/reporting",
                export: "createRevenueDataset",
              },
            },
          ],
        },
      }),
    ])

    expect(graph.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "VOYANT_GRAPH_DUPLICATE_ENTITY_ID",
        message: `Graph entity id "${revenueDataset.id}" is declared more than once.`,
      }),
    )
  })

  it("emits source-free metadata and lazy dataset runtime references", async () => {
    const graph = await graphFor([finance])
    const json = buildDeploymentGraphJson(graph)
    const runtimeSource = buildGraphRuntimeModule({ graph })

    expect(JSON.parse(json).reportingCatalog).toEqual(graph.reportingCatalog)
    expect(json).toContain('"grain": "invoice"')
    expect(runtimeSource).toContain("GENERATED_GRAPH_RUNTIME_REPORTING_CATALOG")
    expect(runtimeSource).toContain('"facet": "reporting.datasets.runtime"')
    expect(runtimeSource).toContain(
      '() => import("@acme/finance/reporting-runtime-body-must-stay-lazy")',
    )
    expect(runtimeSource).not.toContain("createRevenueDataset()")
  })
})
