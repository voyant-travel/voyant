"use client"

import { useNavigate } from "@tanstack/react-router"
import type { FlightOrder, FlightOrderStatus } from "@voyantjs/flights/contract/types"
import { type FlightOrderPaymentStatus, useFlightOrders } from "@voyantjs/flights-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { ArrowDown, ArrowUp, ArrowUpDown, Plane, Search } from "lucide-react"
import { useMemo, useState } from "react"

const STATUS_VARIANTS: Record<
  FlightOrderStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  confirmed: "secondary",
  ticketed: "default",
  cancelled: "destructive",
  failed: "destructive",
}

const PAYMENT_BADGE: Record<
  FlightOrderPaymentStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  none: { label: "Not started", variant: "outline" },
  pending: { label: "Pending", variant: "outline" },
  requires_redirect: { label: "Awaiting card", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  authorized: { label: "Authorized", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
  expired: { label: "Expired", variant: "outline" },
}

type SortKey = "created" | "total"
type SortDir = "asc" | "desc"

const ALL_STATUSES: FlightOrderStatus[] = [
  "pending",
  "confirmed",
  "ticketed",
  "cancelled",
  "failed",
]

const ALL_PAYMENT_STATUSES: FlightOrderPaymentStatus[] = [
  "none",
  "pending",
  "requires_redirect",
  "processing",
  "authorized",
  "paid",
  "failed",
  "cancelled",
  "expired",
]

export function FlightOrdersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [bookingStatus, setBookingStatus] = useState<FlightOrderStatus | "all">("all")
  const [paymentStatus, setPaymentStatus] = useState<FlightOrderPaymentStatus | "all">("all")
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "created", dir: "desc" })

  const ordersQuery = useFlightOrders({
    search: debouncedSearch || undefined,
    limit: 100,
    status: bookingStatus === "all" ? undefined : [bookingStatus],
    paymentStatus: paymentStatus === "all" ? undefined : [paymentStatus],
  })

  function onSearchChange(next: string) {
    setSearch(next)
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => setDebouncedSearch(next), 250)
  }

  const orders = useMemo(() => {
    const rows = ordersQuery.data?.orders ?? []
    const sorted = [...rows].sort((a, b) => {
      if (sort.key === "created") {
        return a.createdAt.localeCompare(b.createdAt) * (sort.dir === "asc" ? 1 : -1)
      }
      const av = Number.parseFloat(a.totalPrice.amount)
      const bv = Number.parseFloat(b.totalPrice.amount)
      return (av - bv) * (sort.dir === "asc" ? 1 : -1)
    })
    return sorted
  }, [ordersQuery.data, sort])

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "created" ? "desc" : "asc" },
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Flight orders</h1>
          <p className="text-muted-foreground text-sm">
            Bookings created through the flights search. Click a row to open the order detail.
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/flights" })}>
          <Plane className="mr-2 h-4 w-4" />
          New search
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by PNR, passenger name, or email…"
            className="pl-9"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Select
          value={bookingStatus}
          onValueChange={(v) => setBookingStatus(v as FlightOrderStatus | "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Booking status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bookings</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={paymentStatus}
          onValueChange={(v) => setPaymentStatus(v as FlightOrderPaymentStatus | "all")}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Payment status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            {ALL_PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PAYMENT_BADGE[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ordersQuery.isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
          Loading orders…
        </div>
      ) : ordersQuery.error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm">
          {ordersQuery.error instanceof Error
            ? ordersQuery.error.message
            : "Failed to load orders."}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <Plane className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="font-medium text-base">
            {debouncedSearch || bookingStatus !== "all" || paymentStatus !== "all"
              ? "No orders match these filters"
              : "No flight orders yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
            {debouncedSearch || bookingStatus !== "all" || paymentStatus !== "all"
              ? "Try clearing the filters or running a new search."
              : "Run a flight search and book one to see it here."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortHeader
                    label="Order"
                    sortKey="created"
                    activeKey={sort.key}
                    activeDir={sort.dir}
                    onClick={() => toggleSort("created")}
                  />
                </TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Passenger</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">
                  <SortHeader
                    label="Total"
                    sortKey="total"
                    activeKey={sort.key}
                    activeDir={sort.dir}
                    onClick={() => toggleSort("total")}
                    align="right"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <FlightOrderRow
                  key={order.orderId}
                  order={order}
                  onOpen={() =>
                    navigate({
                      to: "/flights/orders/$orderId",
                      params: { orderId: order.orderId },
                    })
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {ordersQuery.data?.pagination?.total != null && (
        <p className="text-muted-foreground text-xs">
          Showing {orders.length} of {ordersQuery.data.pagination.total}
          {ordersQuery.data.pagination.hasMore ? " (more available)" : ""}
        </p>
      )}
    </div>
  )
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function SortHeader({
  label,
  sortKey,
  activeKey,
  activeDir,
  onClick,
  align = "left",
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  activeDir: SortDir
  onClick: () => void
  align?: "left" | "right"
}) {
  const active = sortKey === activeKey
  const Icon = !active ? ArrowUpDown : activeDir === "asc" ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mx-1 flex w-full items-center gap-1 rounded px-1 py-0.5 hover:bg-muted/40 ${
        align === "right" ? "justify-end" : ""
      } ${active ? "text-foreground" : "text-muted-foreground"}`}
    >
      {label}
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function FlightOrderRow({ order, onOpen }: { order: FlightOrder; onOpen: () => void }) {
  const route = formatRoute(order)
  const passenger = order.passengers[0]
  const passengerLabel = passenger
    ? `${passenger.firstName} ${passenger.lastName}`.trim() +
      (order.passengers.length > 1 ? ` +${order.passengers.length - 1}` : "")
    : "—"
  const paymentStatus =
    typeof order.providerData?.paymentStatus === "string"
      ? (order.providerData.paymentStatus as FlightOrderPaymentStatus)
      : "none"
  const paymentCfg = PAYMENT_BADGE[paymentStatus] ?? PAYMENT_BADGE.none
  return (
    <TableRow className="cursor-pointer hover:bg-muted/30" onClick={onOpen}>
      <TableCell className="font-mono text-xs">
        <div className="font-medium">{order.pnr ?? order.orderId.slice(0, 12)}</div>
        <div className="text-muted-foreground">{order.orderId}</div>
      </TableCell>
      <TableCell className="text-sm">{route}</TableCell>
      <TableCell className="text-sm">{passengerLabel}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANTS[order.status] ?? "outline"}>{order.status}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={paymentCfg.variant}>{paymentCfg.label}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(order.totalPrice.amount, order.totalPrice.currency)}
      </TableCell>
    </TableRow>
  )
}

function formatRoute(order: FlightOrder): string {
  const parts: string[] = []
  for (const itin of order.offer.itineraries) {
    if (itin.segments.length === 0) continue
    const first = itin.segments[0]
    const last = itin.segments[itin.segments.length - 1]
    if (!first || !last) continue
    parts.push(`${first.departure.iataCode} → ${last.arrival.iataCode}`)
  }
  return parts.join("  ·  ") || "—"
}

function formatMoney(amount: string, currency: string): string {
  const n = Number.parseFloat(amount)
  if (!Number.isFinite(n)) return `${amount} ${currency}`
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n)
}
