"use client"

import { Badge, Button } from "@voyant-travel/ui/components"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Activity, Loader2 } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"
import { useFinanceUiI18nOrDefault, useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import type { FinanceActionLedgerEntryRecord, FinanceActionLedgerListResponse } from "../index.js"
import { useInvoiceActionLedger, usePaymentSessionActionLedger } from "../index.js"

export interface InvoiceActionLedgerCardProps {
  invoiceId: string
  limit?: number
  className?: string
  /** When true, render only the entries without the bordered section + title bar. */
  bare?: boolean
}

export function InvoiceActionLedgerCard({
  invoiceId,
  limit = 20,
  className,
  bare,
}: InvoiceActionLedgerCardProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage
  const [cursor, setCursor] =
    useState<FinanceActionLedgerListResponse["pageInfo"]["nextCursor"]>(null)
  const actionLedgerQuery = useInvoiceActionLedger(invoiceId, { cursor, limit })

  return (
    <FinanceActionLedgerCard
      dataSlot="invoice-action-ledger-card"
      title={detail.titles.actionLedger}
      loadOlderLabel={detail.actions.loadOlderActionLedger}
      emptyLabel={detail.states.noActionLedger}
      loadFailedLabel={detail.states.actionLedgerLoadFailed}
      className={className}
      bare={bare}
      cursor={cursor}
      setCursor={setCursor}
      query={actionLedgerQuery}
    />
  )
}

export interface PaymentSessionActionLedgerCardProps {
  paymentSessionId: string
  limit?: number
  className?: string
}

export function PaymentSessionActionLedgerCard({
  paymentSessionId,
  limit = 20,
  className,
}: PaymentSessionActionLedgerCardProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage
  const [cursor, setCursor] =
    useState<FinanceActionLedgerListResponse["pageInfo"]["nextCursor"]>(null)
  const actionLedgerQuery = usePaymentSessionActionLedger(paymentSessionId, { cursor, limit })

  return (
    <FinanceActionLedgerCard
      dataSlot="payment-session-action-ledger-card"
      title={detail.titles.actionLedger}
      loadOlderLabel={detail.actions.loadOlderActionLedger}
      emptyLabel={detail.states.noActionLedger}
      loadFailedLabel={detail.states.actionLedgerLoadFailed}
      className={className}
      cursor={cursor}
      setCursor={setCursor}
      query={actionLedgerQuery}
    />
  )
}

function FinanceActionLedgerCard({
  dataSlot,
  title,
  loadOlderLabel,
  emptyLabel,
  loadFailedLabel,
  className,
  bare,
  cursor,
  setCursor,
  query,
}: {
  dataSlot: string
  title: string
  loadOlderLabel: string
  emptyLabel: string
  loadFailedLabel: string
  className?: string
  bare?: boolean
  cursor: FinanceActionLedgerListResponse["pageInfo"]["nextCursor"]
  setCursor: (cursor: FinanceActionLedgerListResponse["pageInfo"]["nextCursor"]) => void
  query:
    | ReturnType<typeof useInvoiceActionLedger>
    | ReturnType<typeof usePaymentSessionActionLedger>
}) {
  const { formatDateTime } = useFinanceUiI18nOrDefault()
  const [pages, setPages] = useState<FinanceActionLedgerListResponse[]>([])

  useEffect(() => {
    const page = query.data
    if (!page) return

    setPages((currentPages) => {
      if (currentPages.some((currentPage) => currentPage.data[0]?.id === page.data[0]?.id)) {
        return currentPages
      }
      return cursor ? [...currentPages, page] : [page]
    })
  }, [query.data, cursor])

  const entries = pages.flatMap((page) => page.data)
  const nextCursor = pages.at(-1)?.pageInfo.nextCursor ?? null

  return (
    <ActionLedgerSection dataSlot={dataSlot} title={title} className={className} bare={bare}>
      {query.isPending && entries.length === 0 ? (
        <ActionLedgerLoadingRow />
      ) : query.isError && entries.length === 0 ? (
        <ActionLedgerEmptyRow>{loadFailedLabel}</ActionLedgerEmptyRow>
      ) : entries.length === 0 ? (
        <ActionLedgerEmptyRow>{emptyLabel}</ActionLedgerEmptyRow>
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
              disabled={query.isFetching}
              onClick={() => setCursor(nextCursor)}
            >
              {query.isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {loadOlderLabel}
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
        {entry.mutationSummary ? (
          <p className="mt-1 truncate text-muted-foreground text-xs">{entry.mutationSummary}</p>
        ) : null}
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
  bare,
}: {
  dataSlot: string
  title: string
  children: ReactNode
  className?: string
  bare?: boolean
}) {
  if (bare) {
    return (
      <div data-slot={dataSlot} className={className}>
        {children}
      </div>
    )
  }

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
