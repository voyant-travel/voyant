import type { QueryClient } from "@tanstack/react-query"
import { formatMessage } from "@voyantjs/i18n"
import {
  defaultFetcher,
  getLegalContractNumberSeriesQueryOptions,
  useLegalContractNumberSeries,
  useLegalContractNumberSeriesMutation,
} from "@voyantjs/legal-react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import { Badge, Button } from "@/components/ui"

import { useRegistryLegalMessagesOrDefault } from "./i18n/provider"
import { type NumberSeriesData, NumberSeriesDialog } from "./number-series-dialog"

type EnsureQueryData = QueryClient["ensureQueryData"]

export function loadNumberSeriesPage(ensureQueryData: EnsureQueryData) {
  return ensureQueryData(
    getLegalContractNumberSeriesQueryOptions({ baseUrl: "", fetcher: defaultFetcher }),
  )
}

export function NumberSeriesPage() {
  const m = useRegistryLegalMessagesOrDefault()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<NumberSeriesData | undefined>()
  const { remove } = useLegalContractNumberSeriesMutation()
  const { data, isPending, refetch } = useLegalContractNumberSeries()
  const rows = data?.data ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{m.numberSeriesPage.title}</h1>
          <p className="text-sm text-muted-foreground">{m.numberSeriesPage.description}</p>
        </div>
        <Button
          onClick={() => {
            setEditingSeries(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {m.numberSeriesPage.create}
        </Button>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!isPending && rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{m.numberSeriesPage.empty}</p>
        </div>
      ) : null}

      {!isPending && rows.length > 0 ? (
        <div className="rounded border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">{m.numberSeriesPage.columns.code}</th>
                <th className="p-3 text-left font-medium">{m.numberSeriesPage.columns.name}</th>
                <th className="p-3 text-left font-medium">{m.numberSeriesPage.columns.prefix}</th>
                <th className="p-3 text-left font-medium">
                  {m.numberSeriesPage.columns.separator}
                </th>
                <th className="p-3 text-left font-medium">{m.numberSeriesPage.columns.pad}</th>
                <th className="p-3 text-left font-medium">{m.numberSeriesPage.columns.current}</th>
                <th className="p-3 text-left font-medium">{m.numberSeriesPage.columns.reset}</th>
                <th className="p-3 text-left font-medium">{m.numberSeriesPage.columns.scope}</th>
                <th className="p-3 text-left font-medium">{m.numberSeriesPage.columns.status}</th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((series) => (
                <tr key={series.id} className="border-b last:border-b-0">
                  <td className="p-3 font-mono text-xs">{series.code}</td>
                  <td className="p-3">{series.name}</td>
                  <td className="p-3 font-mono">{series.prefix || m.common.noResultsDash}</td>
                  <td className="p-3 font-mono">{series.separator || m.common.noResultsDash}</td>
                  <td className="p-3">{series.padLength}</td>
                  <td className="p-3 font-mono">{series.currentSequence}</td>
                  <td className="p-3">
                    {m.common.resetStrategyLabels[
                      series.resetStrategy as keyof typeof m.common.resetStrategyLabels
                    ] ?? series.resetStrategy}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline">{m.common.contractScopeLabels[series.scope]}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={series.active ? "default" : "secondary"}>
                      {series.active ? m.common.active : m.common.inactive}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSeries(series)
                          setDialogOpen(true)
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              formatMessage(m.numberSeriesPage.confirms.deleteSeries, {
                                code: series.code,
                              }),
                            )
                          ) {
                            remove.mutate(series.id, { onSuccess: () => void refetch() })
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <NumberSeriesDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        series={editingSeries}
        onSuccess={() => {
          setDialogOpen(false)
          setEditingSeries(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
