import { definePort } from "@voyant-travel/core/project"

import type {
  ReportDatasetDefinition,
  ReportParameters,
  ReportQuery,
  ReportResult,
  ReportTemplateDefinition,
  ReportWidgetDefinition,
} from "./contracts.js"

export interface ReportDatasetExecutionContext {
  db: unknown
  actorId?: string
  grantedScopes: readonly string[]
  signal?: AbortSignal
}

export interface ReportDatasetExecutionInput {
  query: ReportQuery
  parameters: ReportParameters
  maximumRows: number
}

export interface ReportDatasetContribution {
  definition: ReportDatasetDefinition
  execute(
    context: ReportDatasetExecutionContext,
    input: ReportDatasetExecutionInput,
  ): Promise<ReportResult> | ReportResult
}

/** One module-owned contribution to the reporting catalog. */
export interface ReportingContributionRuntime {
  namespace: string
  datasets?: readonly ReportDatasetContribution[]
  widgets?: readonly ReportWidgetDefinition[]
  templates?: readonly ReportTemplateDefinition[]
}

export const reportingContributionRuntimePort = definePort<ReportingContributionRuntime>({
  id: "reporting.contribution",
  test(provider) {
    if (!provider || typeof provider !== "object") {
      throw new Error("reporting.contribution provider must be an object.")
    }
    const contribution = provider as ReportingContributionRuntime
    if (typeof contribution.namespace !== "string" || contribution.namespace.length === 0) {
      throw new Error("reporting.contribution provider must declare a namespace.")
    }
    for (const dataset of contribution.datasets ?? []) {
      if (!dataset || typeof dataset !== "object" || typeof dataset.execute !== "function") {
        throw new Error("reporting.contribution datasets must implement execute().")
      }
    }
  },
})
