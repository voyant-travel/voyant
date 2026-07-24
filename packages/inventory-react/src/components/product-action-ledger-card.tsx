"use client"

import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Activity, Loader2 } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"
import { useProductsUiI18nOrDefault } from "../i18n/provider.js"
import type { ProductActionLedgerEntryRecord, ProductActionLedgerListResponse } from "../index.js"
import { useProductActionLedger } from "../index.js"

export interface ProductActionLedgerCardProps {
  productId: string
  limit?: number
  messages?: Partial<ProductActionLedgerCardMessages>
  className?: string
}

export interface ProductActionLedgerCardMessages {
  title: string
  description: string
  loadOlder: string
  empty: string
  loadFailed: string
}

const defaultProductActionLedgerCardMessages = {
  title: "Activity", // i18n-literal-ok: package-owned fallback copy; callers can override.
  description: "Recent product edits and the actor that made them.", // i18n-literal-ok: package-owned fallback copy; callers can override.
  loadOlder: "Load older activity", // i18n-literal-ok: package-owned fallback copy; callers can override.
  empty: "No product activity recorded.", // i18n-literal-ok: package-owned fallback copy; callers can override.
  loadFailed: "Failed to load product activity.", // i18n-literal-ok: package-owned fallback copy; callers can override.
} satisfies ProductActionLedgerCardMessages

export function ProductActionLedgerCard({
  productId,
  limit = 20,
  messages: messagesOverride,
  className,
}: ProductActionLedgerCardProps) {
  const messages = { ...defaultProductActionLedgerCardMessages, ...messagesOverride }
  const [cursor, setCursor] =
    useState<ProductActionLedgerListResponse["pageInfo"]["nextCursor"]>(null)
  const actionLedgerQuery = useProductActionLedger(productId, { cursor, limit })
  const { formatDateTime } = useProductsUiI18nOrDefault()
  const [pages, setPages] = useState<ProductActionLedgerListResponse[]>([])

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
      title={messages.title}
      description={messages.description}
      className={className}
    >
      {actionLedgerQuery.isPending && entries.length === 0 ? (
        <ActionLedgerLoadingRow />
      ) : actionLedgerQuery.isError && entries.length === 0 ? (
        <ActionLedgerEmptyRow>{messages.loadFailed}</ActionLedgerEmptyRow>
      ) : entries.length === 0 ? (
        <ActionLedgerEmptyRow>{messages.empty}</ActionLedgerEmptyRow>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="divide-y rounded-md border bg-background">
            {entries.map((entry) => (
              <ProductActionLedgerEntryItem
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
              {messages.loadOlder}
            </Button>
          ) : null}
        </div>
      )}
    </ActionLedgerSection>
  )
}

function ProductActionLedgerEntryItem({
  entry,
  timestamp,
}: {
  entry: ProductActionLedgerEntryRecord
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
          {formatActionLedgerPrincipal(entry.principalType)} · {timestamp}
        </p>
        {entry.mutationSummary ? (
          <p className="mt-1 truncate text-muted-foreground text-xs">
            {humanizeActionLedgerSummary(entry.mutationSummary)}
          </p>
        ) : null}
      </div>
    </li>
  )
}

function ActionLedgerSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      data-slot="product-action-ledger-card"
      className={cn("rounded-md border bg-background", className)}
    >
      <div className="space-y-1 border-b px-4 py-3">
        <h2 className="font-semibold text-sm">{title}</h2>
        <p className="text-muted-foreground text-xs">{description}</p>
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
  const withoutDomain = actionName.replace(/^product\./, "")
  const label = withoutDomain.replace(/[._-]/g, " ")
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Humanize the principal type (e.g. "api_token" -> "Api token") and hide the raw principal id. */
function formatActionLedgerPrincipal(principalType: string) {
  const label = principalType.replace(/[._-]/g, " ")
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Turn camelCase field identifiers inside a mutation summary into plain words (e.g. "productTypeId" -> "product type"). */
function humanizeActionLedgerSummary(summary: string) {
  return summary.replace(/\b[a-z]+(?:[A-Z][a-zA-Z0-9]*)+\b/g, (token) =>
    token
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\bId\b/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase(),
  )
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
