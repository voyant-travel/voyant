"use client"

import type { FlightOrderStatus } from "@voyant-travel/flights/contract/types"
import { formatMessage } from "@voyant-travel/i18n"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import { Input } from "@voyant-travel/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components/select"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"
import { cn } from "@voyant-travel/ui/lib/utils"
import { ChevronLeft, ChevronRight, Clock, Plane, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { useFlightOrders } from "../hooks/use-flight-orders.js"
import { useFlightsUiI18nOrDefault } from "../i18n/index.js"
import type { FlightOrdersListFilters } from "../query-keys.js"
import type { FlightOrderDto } from "../schemas.js"

const PAGE_SIZE = 20
const ORDER_STATUSES: FlightOrderStatus[] = [
  "pending",
  "confirmed",
  "ticketed",
  "cancelled",
  "failed",
]
/** Sentinel for the "all statuses" option (Select can't hold an empty value). */
const ALL_STATUSES = "__all__"
/** Deadline within this window renders as urgent (amber). */
const DEADLINE_URGENT_MS = 48 * 60 * 60 * 1000

export interface FlightOrdersPageSearchParams {
  q?: string
  status?: FlightOrderStatus
}

export interface FlightOrdersPageProps {
  /** URL-backed filters — keeps the list shareable and reload-stable. */
  search: FlightOrdersPageSearchParams
  onSearchChange: (next: FlightOrdersPageSearchParams) => void
  /** Open the order detail surface. */
  onOpenOrder: (orderId: string) => void
  /** IATA → human-readable airport resolver for the route column. */
  airportName?: (iataCode: string) => string | undefined
  className?: string
}

/**
 * Flights → Orders list. Reads persisted flight orders (holds awaiting
 * ticketing + booked orders) via {@link useFlightOrders}, surfaces the
 * ticketing deadline prominently, and links each row to the detail view where
 * tickets can be issued or the order cancelled.
 *
 * Filters (search + status) live in `search` (URL-backed); the pagination
 * cursor is internal and resets whenever the filters change.
 */
export function FlightOrdersPage({
  search,
  onSearchChange,
  onOpenOrder,
  airportName,
  className,
}: FlightOrdersPageProps) {
  const i18n = useFlightsUiI18nOrDefault()
  const messages = i18n.messages
  const t = messages.flightOrdersPage

  // Cursor pagination — `cursor` is the current page, `history` the stack of
  // prior page cursors for the Back button. Both reset on filter change.
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [history, setHistory] = useState<string[]>([])
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging when filters change
  useEffect(() => {
    setCursor(undefined)
    setHistory([])
  }, [search.q, search.status])

  const filters: FlightOrdersListFilters = {
    limit: PAGE_SIZE,
    ...(cursor ? { cursor } : {}),
    ...(search.q ? { search: search.q } : {}),
    ...(search.status ? { status: [search.status] } : {}),
  }
  const query = useFlightOrders(filters)

  const orders = query.data?.orders ?? []
  const pagination = query.data?.pagination
  const hasFilters = Boolean(search.q || search.status)

  const goNext = () => {
    if (!pagination?.hasMore || !pagination.cursor) return
    setHistory((h) => [...h, cursor ?? ""])
    setCursor(pagination.cursor)
  }
  const goPrev = () => {
    setHistory((h) => {
      const next = h.slice(0, -1)
      setCursor(h[h.length - 1] || undefined)
      return next
    })
  }

  return (
    <div className={cn("mx-auto flex w-full max-w-6xl flex-col gap-6", className)}>
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 font-semibold text-2xl">
          <Plane className="h-6 w-6" />
          {t.title}
        </h1>
        <p className="text-muted-foreground text-sm">{t.description}</p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t.searchPlaceholder}
            defaultValue={search.q ?? ""}
            onChange={(e) => {
              const value = e.target.value.trim()
              onSearchChange({ ...search, q: value || undefined })
            }}
          />
        </div>
        <Select
          value={search.status ?? ALL_STATUSES}
          onValueChange={(value) =>
            onSearchChange({
              ...search,
              status: value === ALL_STATUSES ? undefined : (value as FlightOrderStatus),
            })
          }
        >
          <SelectTrigger className="w-48" aria-label={t.statusFilter}>
            <SelectValue placeholder={t.allStatuses} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>{t.allStatuses}</SelectItem>
            {ORDER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {messages.common.orderStatusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columns.reference}</TableHead>
              <TableHead>{t.columns.route}</TableHead>
              <TableHead>{t.columns.passengers}</TableHead>
              <TableHead>{t.columns.status}</TableHead>
              <TableHead>{t.columns.ticketingDeadline}</TableHead>
              <TableHead className="text-right">{t.columns.total}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <SkeletonRows />
            ) : query.isError ? (
              <MessageRow>
                <div className="flex flex-col items-center gap-2">
                  <span>{t.loadFailed}</span>
                  <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                    {t.retry}
                  </Button>
                </div>
              </MessageRow>
            ) : orders.length === 0 ? (
              <MessageRow>{hasFilters ? t.emptyFiltered : t.empty}</MessageRow>
            ) : (
              orders.map((order) => (
                <OrderRow
                  key={order.orderId}
                  order={order}
                  messages={messages}
                  i18n={i18n}
                  airportName={airportName}
                  onOpen={() => onOpenOrder(order.orderId)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && orders.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            {formatMessage(t.pageSummary, {
              count: orders.length,
              total: pagination.total,
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goPrev} disabled={history.length === 0}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t.previous}
            </Button>
            <Button variant="outline" size="sm" onClick={goNext} disabled={!pagination.hasMore}>
              {t.next}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function OrderRow({
  order,
  messages,
  i18n,
  airportName,
  onOpen,
}: {
  order: FlightOrderDto
  messages: ReturnType<typeof useFlightsUiI18nOrDefault>["messages"]
  i18n: ReturnType<typeof useFlightsUiI18nOrDefault>
  airportName?: (iataCode: string) => string | undefined
  onOpen: () => void
}) {
  const route = routeSummary(order, airportName)
  const total = formatMoney(order.totalPrice.amount, order.totalPrice.currency, i18n)
  const isBad = order.status === "cancelled" || order.status === "failed"

  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell className="font-mono font-medium">{order.pnr ?? order.orderId}</TableCell>
      <TableCell>
        <span className="whitespace-nowrap">{route}</span>
      </TableCell>
      <TableCell className="tabular-nums">{order.passengers.length}</TableCell>
      <TableCell>
        <Badge
          variant={isBad ? "secondary" : "default"}
          className={cn(isBad && "bg-destructive/10 text-destructive")}
        >
          {messages.common.orderStatusLabels[order.status]}
        </Badge>
      </TableCell>
      <TableCell>
        <TicketingDeadline order={order} messages={messages} i18n={i18n} />
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">{total}</TableCell>
    </TableRow>
  )
}

function TicketingDeadline({
  order,
  messages,
  i18n,
}: {
  order: FlightOrderDto
  messages: ReturnType<typeof useFlightsUiI18nOrDefault>["messages"]
  i18n: ReturnType<typeof useFlightsUiI18nOrDefault>
}) {
  const t = messages.flightOrdersPage
  // Only held (confirmed) orders carry a live ticketing deadline.
  if (order.status !== "confirmed" || !order.paymentDeadline) {
    return <span className="text-muted-foreground">{t.noDeadline}</span>
  }
  const deadline = new Date(order.paymentDeadline).getTime()
  const remaining = deadline - Date.now()
  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-destructive">
        <Clock className="h-3.5 w-3.5" />
        {t.deadlinePassed}
      </span>
    )
  }
  const urgent = remaining <= DEADLINE_URGENT_MS
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap",
        urgent && "font-medium text-amber-600",
      )}
    >
      <Clock className="h-3.5 w-3.5" />
      {i18n.formatDateTime(order.paymentDeadline)}
    </span>
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
        <TableRow key={i}>
          {Array.from({ length: 6 }).map((__, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

function MessageRow({ children }: { children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  )
}

/** `LHR → JFK` from the first itinerary; appends `· +N` for multi-leg trips. */
function routeSummary(
  order: FlightOrderDto,
  airportName?: (iataCode: string) => string | undefined,
): string {
  const itineraries = order.offer.itineraries
  const first = itineraries[0]?.segments
  const firstSegment = first?.[0]
  const lastSegment = first?.[first.length - 1]
  if (!firstSegment || !lastSegment) return "—"
  const originCode = firstSegment.departure.iataCode
  const destCode = lastSegment.arrival.iataCode
  const origin = airportName?.(originCode) ?? originCode
  const dest = airportName?.(destCode) ?? destCode
  const extraLegs = itineraries.length - 1
  return extraLegs > 0 ? `${origin} → ${dest} · +${extraLegs}` : `${origin} → ${dest}`
}

function formatMoney(
  amount: string,
  currency: string,
  i18n: ReturnType<typeof useFlightsUiI18nOrDefault>,
): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${amount} ${currency}`
  return i18n.formatCurrency(n, currency, { maximumFractionDigits: 0 })
}
