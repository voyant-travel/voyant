"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import type { ActionLedgerEntryResponse } from "@voyantjs/action-ledger"
import { useLocale } from "@voyantjs/admin"
import type { BookingActionLedgerListResponse } from "@voyantjs/bookings"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { ScrollText } from "lucide-react"
import { useMemo } from "react"
import { api } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"

export interface BookingActionLedgerPanelProps {
  bookingId: string
}

type LedgerBadgeVariant = "default" | "secondary" | "outline" | "destructive"
type BookingActionLedgerTraveler = BookingActionLedgerListResponse["travelers"][number]
type BookingActionLedgerCursor = NonNullable<
  BookingActionLedgerListResponse["pageInfo"]["nextCursor"]
>

const STATUS_VARIANT: Partial<Record<ActionLedgerEntryResponse["status"], LedgerBadgeVariant>> = {
  succeeded: "default",
  approved: "default",
  awaiting_approval: "secondary",
  requested: "secondary",
  denied: "destructive",
  failed: "destructive",
  expired: "destructive",
  cancelled: "destructive",
  superseded: "outline",
  reversed: "outline",
  compensated: "outline",
}

const RISK_VARIANT: Partial<
  Record<ActionLedgerEntryResponse["evaluatedRisk"], LedgerBadgeVariant>
> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  critical: "destructive",
}

export function BookingActionLedgerPanel({ bookingId }: BookingActionLedgerPanelProps) {
  const { resolvedLocale } = useLocale()
  const actionLedgerQuery = useInfiniteQuery({
    queryKey: queryKeys.bookings.actionLedger(bookingId),
    queryFn: ({ pageParam }) => getBookingActionLedger(bookingId, pageParam),
    initialPageParam: null as BookingActionLedgerCursor | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor,
  })

  const pages = actionLedgerQuery.data?.pages ?? []
  const entries = pages.flatMap((page) => page.data)
  const travelers = pages[0]?.travelers ?? []
  const travelersById = useMemo(
    () => new Map(travelers.map((traveler) => [traveler.id, traveler])),
    [travelers],
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4 text-muted-foreground" />
          Action ledger
          {entries.length > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              {entries.length}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {actionLedgerQuery.isLoading ? (
          <p className="px-6 py-6 text-center text-muted-foreground text-sm">
            Loading action ledger…
          </p>
        ) : entries.length === 0 ? (
          <p className="px-6 py-6 text-center text-muted-foreground text-sm">
            No central action ledger entries have been recorded for this booking yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">When</th>
                    <th className="px-4 py-2 text-left font-medium">Action</th>
                    <th className="px-4 py-2 text-left font-medium">Actor</th>
                    <th className="px-4 py-2 text-left font-medium">Target</th>
                    <th className="px-4 py-2 text-left font-medium">Risk</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <LedgerRow
                      key={entry.id}
                      entry={entry}
                      traveler={travelersById.get(entry.targetId) ?? null}
                      locale={resolvedLocale}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {actionLedgerQuery.hasNextPage ? (
              <div className="border-t px-4 py-3 text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={actionLedgerQuery.isFetchingNextPage}
                  onClick={() => void actionLedgerQuery.fetchNextPage()}
                >
                  {actionLedgerQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function LedgerRow({
  entry,
  traveler,
  locale,
}: {
  entry: ActionLedgerEntryResponse
  traveler: BookingActionLedgerTraveler | null
  locale: string
}) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs">
        {formatDateTime(entry.occurredAt, locale)}
      </td>
      <td className="px-4 py-3">
        <div className="font-medium">{formatActionName(entry.actionName)}</div>
        <div className="mt-0.5 text-muted-foreground text-xs">{entry.routeOrToolName ?? "-"}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium">{entry.principalType}</div>
        <div className="mt-0.5 max-w-[13rem] truncate font-mono text-muted-foreground text-xs">
          {entry.principalId}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium">{formatTarget(entry, traveler)}</div>
        <div className="mt-0.5 max-w-[13rem] truncate font-mono text-muted-foreground text-xs">
          {entry.targetId}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant={RISK_VARIANT[entry.evaluatedRisk] ?? "outline"}>
          {entry.evaluatedRisk}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANT[entry.status] ?? "outline"}>{entry.status}</Badge>
      </td>
    </tr>
  )
}

async function getBookingActionLedger(
  bookingId: string,
  cursor: BookingActionLedgerCursor | null,
): Promise<BookingActionLedgerListResponse> {
  const search = new URLSearchParams({ limit: "50" })
  if (cursor) {
    search.set("cursorOccurredAt", cursor.occurredAt)
    search.set("cursorId", cursor.id)
  }

  return api.get<BookingActionLedgerListResponse>(
    `/v1/admin/bookings/${bookingId}/action-ledger?${search}`,
  )
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatActionName(value: string) {
  return value.replaceAll(".", " / ").replaceAll("_", " ")
}

function formatTarget(
  entry: ActionLedgerEntryResponse,
  traveler: BookingActionLedgerTraveler | null,
) {
  if (traveler) {
    return [traveler.firstName, traveler.lastName].filter(Boolean).join(" ") || "Traveler"
  }
  if (entry.targetType === "booking") return "Booking"
  return entry.targetType.replaceAll("_", " ")
}
