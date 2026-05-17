"use client"

import type {
  FinanceActionLedgerEntryRecord,
  FinanceActionLedgerListResponse,
} from "@voyantjs/finance-react"
import { useInvoiceActionLedger } from "@voyantjs/finance-react"
import { Badge, Button } from "@voyantjs/ui/components"
import { cn } from "@voyantjs/ui/lib/utils"
import { Activity, Loader2 } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"

import { useFinanceUiI18nOrDefault, useFinanceUiMessagesOrDefault } from "../i18n/index.js"

export interface InvoiceActionLedgerCardProps {
  invoiceId: string
  limit?: number
  className?: string
}

export function InvoiceActionLedgerCard({
  invoiceId,
  limit = 20,
  className,
}: InvoiceActionLedgerCardProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const { formatDateTime } = useFinanceUiI18nOrDefault()
  const detail = messages.invoiceDetailPage
  const [cursor, setCursor] =
    useState<FinanceActionLedgerListResponse["pageInfo"]["nextCursor"]>(null)
  const [pages, setPages] = useState<FinanceActionLedgerListResponse[]>([])
  const actionLedgerQuery = useInvoiceActionLedger(invoiceId, { cursor, limit })

  useEffect(() => {
    const page = actionLedgerQuery.data
    if (!page) return

    setPages((currentPages) => {
      if (currentPages.some((currentPage) => currentPage.data[0]?.id === page.data[0]?.id)) {
        return currentPages
      }
      return cursor ? [...currentPages, page] : [page]
    })
  }, [actionLedgerQuery.data, cursor])

  const entries = pages.flatMap((page) => page.data)
  const nextCursor = pages.at(-1)?.pageInfo.nextCursor ?? null

  return (
    <ActionLedgerSection
      dataSlot="invoice-action-ledger-card"
      title={detail.titles.actionLedger}
      className={className}
    >
      {actionLedgerQuery.isPending && entries.length === 0 ? (
        <ActionLedgerLoadingRow />
      ) : actionLedgerQuery.isError && entries.length === 0 ? (
        <ActionLedgerEmptyRow>{detail.states.actionLedgerLoadFailed}</ActionLedgerEmptyRow>
      ) : entries.length === 0 ? (
        <ActionLedgerEmptyRow>{detail.states.noActionLedger}</ActionLedgerEmptyRow>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="divide-y rounded-md border bg-background">
            {entries.map((entry) => (
              <InvoiceActionLedgerEntryItem
                key={entry.id}
                entry={entry}
                timestamp={formatDateTime(entry.occurredAt)}
              />
            ))}
          </ul>
          {nextCursor ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={actionLedgerQuery.isFetching}
              onClick={() => setCursor(nextCursor)}
            >
              {actionLedgerQuery.isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {detail.actions.loadOlderActionLedger}
            </Button>
          ) : null}
        </div>
      )}
    </ActionLedgerSection>
  )
}

function InvoiceActionLedgerEntryItem({
  entry,
  timestamp,
}: {
  entry: FinanceActionLedgerEntryRecord
  timestamp: string
}) {
  return (
    <li className="flex items-start gap-3 p-3">
      <Activity className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-sm">{formatActionLedgerName(entry.actionName)}</p>
          <Badge variant={actionLedgerStatusVariant[entry.status] ?? "secondary"}>
            {entry.status.replace(/_/g, " ")}
          </Badge>
          <Badge variant={actionLedgerRiskVariant[entry.evaluatedRisk] ?? "outline"}>
            {entry.evaluatedRisk}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-xs">
          {entry.principalType}:{entry.principalId} - {timestamp}
        </p>
        <p className="mt-1 truncate font-mono text-muted-foreground text-xs">
          {entry.targetType}:{entry.targetId}
        </p>
      </div>
    </li>
  )
}

function ActionLedgerSection({
  dataSlot,
  title,
  children,
  className,
}: {
  dataSlot: string
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section data-slot={dataSlot} className={cn("rounded-md border bg-background", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function ActionLedgerEmptyRow({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

function ActionLedgerLoadingRow() {
  return (
    <div className="flex justify-center py-6">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  )
}

function formatActionLedgerName(actionName: string) {
  const withoutDomain = actionName.replace(/^finance\./, "")
  const label = withoutDomain.replace(/[._-]/g, " ")
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export const actionLedgerStatusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  requested: "outline",
  awaiting_approval: "secondary",
  approved: "secondary",
  denied: "destructive",
  succeeded: "default",
  failed: "destructive",
  reversed: "secondary",
  compensated: "secondary",
  expired: "secondary",
  cancelled: "secondary",
  superseded: "secondary",
}

export const actionLedgerRiskVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
  critical: "destructive",
}
