"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAdminNavigate } from "@voyant-travel/admin"
import { useVoyantReactContext } from "@voyant-travel/react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@voyant-travel/ui/components"
import { useState } from "react"

import {
  createReport,
  getCatalogQueryOptions,
  getReportsQueryOptions,
  instantiateTemplate,
  type ReportDefinitionRow,
  reportingQueryKeys,
} from "../api.js"
import type { ReportingClient } from "../client.js"

/**
 * Report list with the create / instantiate-template / open flows. The route
 * loader has already primed the reports query, so this renders instantly and
 * refetches in the background.
 */
export default function ReportsIndexPage() {
  const { baseUrl, fetcher } = useVoyantReactContext()
  const client: ReportingClient = { baseUrl, fetcher }
  const queryClient = useQueryClient()
  const navigate = useAdminNavigate()

  const reportsQuery = useQuery(getReportsQueryOptions(client))
  const catalogQuery = useQuery(getCatalogQueryOptions(client))

  const [newName, setNewName] = useState("")

  const createMutation = useMutation({
    mutationFn: (name: string) => createReport(client, { name }),
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: reportingQueryKeys.reports() })
      navigate("report.detail", { reportId: row.id })
    },
  })

  const instantiateMutation = useMutation({
    mutationFn: (input: { templateId: string; name: string; version?: number }) =>
      instantiateTemplate(client, input.templateId, { name: input.name, version: input.version }),
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: reportingQueryKeys.reports() })
      navigate("report.detail", { reportId: row.id })
    },
  })

  const reports = reportsQuery.data?.data ?? []
  const templates = catalogQuery.data?.templates ?? []

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm">
            Build and manage dashboards from your reporting datasets.
          </p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const name = newName.trim()
            if (name.length > 0) createMutation.mutate(name)
          }}
        >
          <Input
            className="w-56"
            placeholder="New report name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            aria-label="New report name"
          />
          <Button type="submit" size="sm" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create"}
          </Button>
        </form>
      </header>

      {templates.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Start from a template
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={`${template.id}@${template.version}`} size="sm">
                <CardHeader>
                  <CardTitle className="text-base">{template.label}</CardTitle>
                  {template.description ? (
                    <CardDescription>{template.description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={instantiateMutation.isPending}
                    onClick={() =>
                      instantiateMutation.mutate({
                        templateId: template.id,
                        name: template.label,
                        version: template.version,
                      })
                    }
                  >
                    Use template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Your reports
        </h2>
        {reportsQuery.isPending ? (
          <p className="text-muted-foreground text-sm">Loading reports…</p>
        ) : reports.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No reports yet. Create one above or start from a template.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {reports.map((report: ReportDefinitionRow) => (
              <li key={report.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">{report.name}</p>
                  {report.description ? (
                    <p className="text-muted-foreground text-sm">{report.description}</p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("report.detail", { reportId: report.id })}
                >
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
