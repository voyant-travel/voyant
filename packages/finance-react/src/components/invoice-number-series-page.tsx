"use client"

import { formatMessage } from "@voyant-travel/i18n"
import {
  Badge,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import { invoiceNumberSeriesScopes } from "../i18n/messages.js"
import {
  type InvoiceNumberSeriesRecord,
  type InvoiceNumberSeriesScope,
  useInvoiceNumberSeries,
  useInvoiceNumberSeriesMutation,
} from "../index.js"
import { InvoiceNumberSeriesDialog } from "./invoice-number-series-dialog.js"
import { formatInvoiceNumberSeriesSample } from "./invoice-number-series-format.js"

const SCOPE_ALL = "__all__"
const ACTIVE_ALL = "__all__"
const ACTIVE_ONLY = "active"
const INACTIVE_ONLY = "inactive"

export interface InvoiceNumberSeriesPageProps {
  className?: string
}

function activeFilterToBoolean(value: string) {
  if (value === ACTIVE_ONLY) return true
  if (value === INACTIVE_ONLY) return false
  return undefined
}

export function InvoiceNumberSeriesPage({ className }: InvoiceNumberSeriesPageProps = {}) {
  const messages = useFinanceUiMessagesOrDefault()
  const page = messages.invoiceNumberSeriesPage
  const [scope, setScope] = useState<string>(SCOPE_ALL)
  const [active, setActive] = useState<string>(ACTIVE_ALL)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<InvoiceNumberSeriesRecord | undefined>()
  const activeFilter = activeFilterToBoolean(active)

  const { data, isPending, isError, refetch } = useInvoiceNumberSeries({
    limit: 100,
    offset: 0,
    ...(scope === SCOPE_ALL ? {} : { scope: scope as InvoiceNumberSeriesScope }),
    ...(activeFilter === undefined ? {} : { active: activeFilter }),
  })
  const { remove } = useInvoiceNumberSeriesMutation()
  const rows = data?.data ?? []

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{page.title}</h1>
          <p className="text-sm text-muted-foreground">{page.description}</p>
        </div>
        <Button
          onClick={() => {
            setEditingSeries(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {page.actions.create}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-col gap-1.5">
          <Label>{page.filters.scopeLabel}</Label>
          <Select value={scope} onValueChange={(value) => setScope(value ?? SCOPE_ALL)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SCOPE_ALL}>{page.filters.scopeAll}</SelectItem>
              {invoiceNumberSeriesScopes.map((value) => (
                <SelectItem key={value} value={value}>
                  {page.scopeLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-48 flex-col gap-1.5">
          <Label>{page.filters.activeLabel}</Label>
          <Select value={active} onValueChange={(value) => setActive(value ?? ACTIVE_ALL)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ACTIVE_ALL}>{page.filters.activeAll}</SelectItem>
              <SelectItem value={ACTIVE_ONLY}>{page.filters.activeOnly}</SelectItem>
              <SelectItem value={INACTIVE_ONLY}>{page.filters.inactiveOnly}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!isPending && isError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {page.loadFailed}
        </div>
      ) : null}

      {!isPending && !isError && rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{page.empty}</p>
        </div>
      ) : null}

      {!isPending && !isError && rows.length > 0 ? (
        <div className="overflow-hidden rounded border bg-background">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-3 text-left font-medium">{page.columns.code}</th>
                  <th className="p-3 text-left font-medium">{page.columns.name}</th>
                  <th className="p-3 text-left font-medium">{page.columns.prefix}</th>
                  <th className="p-3 text-left font-medium">{page.columns.current}</th>
                  <th className="p-3 text-left font-medium">{page.columns.reset}</th>
                  <th className="p-3 text-left font-medium">{page.columns.scope}</th>
                  <th className="p-3 text-left font-medium">{page.columns.default}</th>
                  <th className="p-3 text-left font-medium">{page.columns.status}</th>
                  <th className="p-3 text-left font-medium">{page.columns.external}</th>
                  <th className="w-20 p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((series) => (
                  <tr key={series.id} className="border-b last:border-b-0">
                    <td className="p-3 font-mono">{series.code}</td>
                    <td className="p-3">{series.name}</td>
                    <td className="p-3 font-mono">{formatInvoiceNumberSeriesSample(series)}</td>
                    <td className="p-3 font-mono">{series.currentSequence}</td>
                    <td className="p-3">{page.resetStrategyLabels[series.resetStrategy]}</td>
                    <td className="p-3">
                      <Badge variant="outline">{page.scopeLabels[series.scope]}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={series.isDefault ? "default" : "secondary"}>
                        {series.isDefault ? page.default : page.notDefault}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={series.active ? "default" : "secondary"}>
                        {series.active ? page.active : page.inactive}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {series.externalProvider ? (
                        <span className="font-mono text-xs">
                          {series.externalProvider}
                          {series.externalConfigKey ? `/${series.externalConfigKey}` : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{page.noExternalProvider}</span>
                      )}
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
                            if (confirm(formatMessage(page.deleteConfirm, { name: series.name }))) {
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
        </div>
      ) : null}

      <InvoiceNumberSeriesDialog
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
