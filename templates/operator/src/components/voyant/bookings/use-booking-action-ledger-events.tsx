"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import type { ActionLedgerEntryResponse } from "@voyantjs/action-ledger"
import type { BookingActionLedgerListResponse } from "@voyantjs/bookings"
import type { TimelineEvent } from "@voyantjs/bookings-ui/components/booking-activity-timeline"
import { Button } from "@voyantjs/ui/components/button"
import { ScrollText } from "lucide-react"
import { useMemo } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"

type BookingActionLedgerTraveler = BookingActionLedgerListResponse["travelers"][number]
type BookingActionLedgerCursor = NonNullable<
  BookingActionLedgerListResponse["pageInfo"]["nextCursor"]
>

/**
 * Fetch the booking's central action-ledger entries and map them into
 * `TimelineEvent`s so they can be merged into `BookingActivityTimeline`.
 * Replaces the standalone Ledger tab — operators see one chronological
 * activity feed instead of two siblings tabs.
 *
 * Returns a "Load more" `footer` element when the cursor pager hasn't
 * exhausted yet so the timeline can render it below the event list.
 */
export function useBookingActionLedgerEvents(bookingId: string): {
  events: TimelineEvent[]
  footer: React.ReactNode | null
} {
  const t = useAdminMessages().bookings.detail.actionLedger
  const ledgerQuery = useInfiniteQuery({
    queryKey: queryKeys.bookings.actionLedger(bookingId),
    queryFn: ({ pageParam }) => fetchBookingActionLedger(bookingId, pageParam),
    initialPageParam: null as BookingActionLedgerCursor | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor,
  })

  const pages = ledgerQuery.data?.pages ?? []
  const travelers = pages[0]?.travelers ?? []
  const travelersById = useMemo(
    () => new Map(travelers.map((traveler) => [traveler.id, traveler])),
    [travelers],
  )

  const events = useMemo<TimelineEvent[]>(() => {
    const all: TimelineEvent[] = []
    for (const page of pages) {
      for (const entry of page.data) {
        const traveler = travelersById.get(entry.targetId) ?? null
        all.push({
          id: `action:${entry.id}`,
          source: "action",
          title: formatActionName(entry.actionName),
          description: formatLedgerDescription(
            entry,
            traveler,
            t.travelerFallback,
            t.targetBooking,
          ),
          actorId: entry.principalId,
          timestamp: entry.occurredAt,
          icon: ScrollText,
        })
      }
    }
    return all
  }, [pages, travelersById, t.targetBooking, t.travelerFallback])

  const footer = ledgerQuery.hasNextPage ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={ledgerQuery.isFetchingNextPage}
      onClick={() => void ledgerQuery.fetchNextPage()}
    >
      {ledgerQuery.isFetchingNextPage ? t.loadingMore : t.loadMore}
    </Button>
  ) : null

  return { events, footer }
}

async function fetchBookingActionLedger(
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

function formatActionName(value: string) {
  return value.replaceAll(".", " / ").replaceAll("_", " ")
}

function formatTarget(
  entry: ActionLedgerEntryResponse,
  traveler: BookingActionLedgerTraveler | null,
  travelerFallback: string,
  bookingFallback: string,
) {
  if (traveler) {
    return [traveler.firstName, traveler.lastName].filter(Boolean).join(" ") || travelerFallback
  }
  if (entry.targetType === "booking") return bookingFallback
  return entry.targetType.replaceAll("_", " ")
}

function formatLedgerDescription(
  entry: ActionLedgerEntryResponse,
  traveler: BookingActionLedgerTraveler | null,
  travelerFallback: string,
  bookingFallback: string,
) {
  // status / target / risk are machine-readable enum strings the
  // ledger ships unmodified (matches the standalone panel behaviour).
  const parts = [
    entry.status,
    formatTarget(entry, traveler, travelerFallback, bookingFallback),
    entry.evaluatedRisk,
  ]
  if (entry.routeOrToolName) parts.push(entry.routeOrToolName)
  return parts.join(" · ")
}
