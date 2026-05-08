import type { QueryClient } from "@tanstack/react-query"
import {
  getLegalContractNumberSeriesQueryOptions,
  useLegalContractNumberSeries,
  useLegalContractNumberSeriesMutation,
} from "@voyantjs/legal-react"
import { Badge, Button } from "@voyantjs/ui/components"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { legalQueryClient } from "./legal-query-client"
import { type NumberSeriesData, NumberSeriesDialog } from "./number-series-dialog"

export function loadNumberSeriesPage(queryClient: QueryClient) {
  return queryClient.ensureQueryData(getLegalContractNumberSeriesQueryOptions(legalQueryClient))
}

export function NumberSeriesPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<NumberSeriesData | undefined>()
  const { remove } = useLegalContractNumberSeriesMutation()
  const { data, isPending, refetch } = useLegalContractNumberSeries()
  const rows = data?.data ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contract Number Series</h1>
          <p className="text-sm text-muted-foreground">
            Configure numbering sequences for contracts.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingSeries(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Series
        </Button>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!isPending && rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No number series yet. Create one to configure contract numbering.
          </p>
        </div>
      ) : null}

      {!isPending && rows.length > 0 ? (
        <div className="rounded border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">Name</th>
                <th className="p-3 text-left font-medium">Prefix</th>
                <th className="p-3 text-left font-medium">Separator</th>
                <th className="p-3 text-left font-medium">Pad</th>
                <th className="p-3 text-left font-medium">Current</th>
                <th className="p-3 text-left font-medium">Reset</th>
                <th className="p-3 text-left font-medium">Scope</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((series) => (
                <tr key={series.id} className="border-b last:border-b-0">
                  <td className="p-3">{series.name}</td>
                  <td className="p-3 font-mono">{series.prefix}</td>
                  <td className="p-3 font-mono">{series.separator || "-"}</td>
                  <td className="p-3">{series.padLength}</td>
                  <td className="p-3 font-mono">{series.currentSequence}</td>
                  <td className="p-3 capitalize">{series.resetStrategy}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="capitalize">
                      {series.scope}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={series.active ? "default" : "secondary"}>
                      {series.active ? "Active" : "Inactive"}
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
                          if (confirm(`Delete series "${series.name}"?`)) {
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
