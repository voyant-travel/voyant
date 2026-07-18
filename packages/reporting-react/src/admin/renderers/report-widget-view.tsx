"use client"

import { useQuery } from "@tanstack/react-query"
import type { ReportParameters, ReportWidgetDefinition } from "@voyant-travel/reporting-contracts"
import type { ReactNode } from "react"

import { previewQuery } from "../api.js"
import type { ReportingClient } from "../client.js"
import type { FormatOptions } from "./format.js"
import { ReportVisualizationView } from "./report-renderer.js"

export interface ReportWidgetViewProps {
  readonly definition: ReportWidgetDefinition
  readonly client: ReportingClient
  readonly parameters?: ReportParameters
  readonly format?: FormatOptions
  /** Disable data fetching (e.g. while a custom widget's query is still being authored). */
  readonly enabled?: boolean
}

/**
 * Fetches a widget's data through the bounded `/queries/preview` endpoint (never
 * raw SQL/JS) and renders it with the generic visualization renderer. Loading
 * and error states are self-contained so the grid cell always has a body.
 */
export function ReportWidgetView({
  definition,
  client,
  parameters = {},
  format,
  enabled = true,
}: ReportWidgetViewProps): ReactNode {
  const query = useQuery({
    queryKey: ["reporting", "widget-preview", definition.query, parameters],
    queryFn: () => previewQuery(client, { query: definition.query, parameters }),
    enabled,
  })

  if (!enabled) {
    return <p className="text-muted-foreground text-sm">Configure the query to preview data.</p>
  }
  if (query.isPending) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Loading…
      </p>
    )
  }
  if (query.isError) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {query.error instanceof Error ? query.error.message : "Failed to load widget data."}
      </p>
    )
  }
  return <ReportVisualizationView definition={definition} result={query.data} format={format} />
}
