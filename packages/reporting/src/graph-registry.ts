import type {
  VoyantGraphReportingCatalog,
  VoyantGraphRuntimeFactoryGraph,
} from "@voyant-travel/core/project"
import {
  type ReportDatasetContribution,
  type ReportDatasetRuntime,
  type ReportingContributionRuntime,
  reportDatasetDefinitionSchema,
  reportTemplateDefinitionSchema,
  reportWidgetDefinitionSchema,
} from "@voyant-travel/reporting-contracts"

import { ReportingRegistry, ReportingRegistryError } from "./registry.js"

export interface ReportingRegistryGraphView {
  reportingCatalog?: VoyantGraphReportingCatalog
  references: VoyantGraphRuntimeFactoryGraph["references"]
}

/**
 * Assemble Reporting directly from the selected manifest graph. The additive runtime port remains
 * available for host-owned or otherwise programmatic contributions which do not belong in a
 * package manifest.
 */
export async function createReportingRegistryFromGraph(input: {
  graph: ReportingRegistryGraphView
  contributions?: readonly ReportingContributionRuntime[]
}): Promise<ReportingRegistry> {
  const catalog = input.graph.reportingCatalog
  if (!catalog) return new ReportingRegistry(input.contributions ?? [])

  const references = new Map(input.graph.references.map((reference) => [reference.id, reference]))
  const datasets = await Promise.all(
    catalog.datasets.map(async (dataset): Promise<ReportDatasetContribution> => {
      const reference = references.get(dataset.runtimeReferenceId)
      if (
        reference?.facet !== "reporting.datasets.runtime" ||
        reference.entityId !== dataset.id ||
        reference.unitId !== dataset.ownerUnitId
      ) {
        throw new ReportingRegistryError(
          `Dataset ${JSON.stringify(dataset.id)} has no matching admitted runtime reference.`,
        )
      }

      const runtime = await reference.load<unknown>()
      if (!isDatasetRuntime(runtime)) {
        throw new ReportingRegistryError(
          `Dataset ${JSON.stringify(dataset.id)} runtime must export an object with execute().`,
        )
      }

      const definition = reportDatasetDefinitionSchema.parse({
        id: dataset.id,
        version: dataset.version,
        label: dataset.label,
        ...(dataset.description ? { description: dataset.description } : {}),
        ...dataset.descriptor,
        requiredScopes: dataset.requiredScopes ?? [],
      })
      return {
        definition,
        execute: (context, executionInput) => runtime.execute(context, executionInput),
      }
    }),
  )

  const widgets = catalog.widgets.map((widget) =>
    reportWidgetDefinitionSchema.parse({
      id: widget.id,
      version: widget.version,
      label: widget.label,
      ...(widget.description ? { description: widget.description } : {}),
      query: {
        ...widget.query,
        dataset: { id: widget.datasetId },
        filters: widget.query.filters ?? [],
        groupBy: widget.query.groupBy ?? [],
        orderBy: widget.query.orderBy ?? [],
      },
      visualization: {
        ...widget.visualization,
        options: widget.visualization.options ?? {},
      },
      defaultSize: widget.defaultSize,
      ...(widget.minSize ? { minimumSize: widget.minSize } : {}),
      ...(widget.maxSize ? { maximumSize: widget.maxSize } : {}),
    }),
  )

  const templates = catalog.templates.map((template) =>
    reportTemplateDefinitionSchema.parse({
      id: template.id,
      version: template.version,
      label: template.label,
      ...(template.description ? { description: template.description } : {}),
      parameters: template.parameters ?? [],
      widgets: template.widgets.map((widget) => ({
        id: widget.id,
        source: { kind: "preset", widgetId: widget.widgetId },
        ...(widget.title ? { title: widget.title } : {}),
        layout: widget.layout,
      })),
    }),
  )

  return new ReportingRegistry([
    {
      namespace: "deployment-graph",
      datasets,
      widgets,
      templates,
    },
    ...(input.contributions ?? []),
  ])
}

function isDatasetRuntime(value: unknown): value is ReportDatasetRuntime {
  return Boolean(
    value && typeof value === "object" && typeof Reflect.get(value, "execute") === "function",
  )
}
