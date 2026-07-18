"use client"

import { useQuery } from "@tanstack/react-query"
import type { AdminRoutePageProps } from "@voyant-travel/admin"
import { useVoyantReactContext } from "@voyant-travel/react"

import { getCatalogQueryOptions, getReportQueryOptions } from "../api.js"
import type { ReportingClient } from "../client.js"
import { ReportBuilderAdmin } from "../report-builder-admin.js"

/**
 * Report detail route. Loads the report definition (primed by the route loader)
 * and the reporting catalog, then mounts the instance-aware builder with an
 * explicit view/edit toggle.
 */
export default function ReportDetailPage({ params }: AdminRoutePageProps) {
  const id = params.id
  const { baseUrl, fetcher } = useVoyantReactContext()
  const client: ReportingClient = { baseUrl, fetcher }

  const reportQuery = useQuery({ ...getReportQueryOptions(client, id ?? ""), enabled: Boolean(id) })
  const catalogQuery = useQuery(getCatalogQueryOptions(client))

  if (!id) return <p className="text-destructive text-sm">Missing report id.</p>
  if (reportQuery.isPending || catalogQuery.isPending) {
    return <p className="text-muted-foreground text-sm">Loading report…</p>
  }
  if (reportQuery.isError || !reportQuery.data) {
    return <p className="text-destructive text-sm">Report not found.</p>
  }

  return (
    <ReportBuilderAdmin
      // Remount when the route's report id changes so the document controller's
      // baseline re-aligns with the freshly loaded report.
      key={id}
      client={client}
      catalog={catalogQuery.data ?? { datasets: [], widgets: [], templates: [] }}
      report={reportQuery.data}
      initialMode="view"
    />
  )
}
