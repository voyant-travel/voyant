"use client"

import {
  type BookingRecord,
  type BookingsListSortDir,
  type BookingsListSortField,
  bookingStatusBadgeVariant,
  useBookings,
} from "@voyantjs/bookings-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Search, X } from "lucide-react"
import * as React from "react"

import {
  formatMessage,
  useBookingsUiI18nOrDefault,
  useBookingsUiMessagesOrDefault,
} from "../i18n/provider.js"
import { BookingDialog } from "./booking-dialog.js"
import { BOOKING_STATUS_ALL, BookingListFiltersPopover } from "./booking-list-filters.js"

export interface BookingListProps {
  pageSize?: number
  onSelectBooking?: (booking: BookingRecord) => void
}

type SortableField = Exclude<BookingsListSortField, "createdAt">

const SORTABLE_COLUMNS = {
  bookingNumber: "bookingNumber",
  status: "status",
  sellAmount: "sellAmount",
  pax: "pax",
  startDate: "startDate",
  endDate: "endDate",
} as const satisfies Record<SortableField, SortableField>

const SKELETON_ROW_COUNT = 6
const TABLE_COLUMN_COUNT = 7

export function BookingList({ pageSize = 25, onSelectBooking }: BookingListProps = {}) {
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<string>(BOOKING_STATUS_ALL)
  const [productId, setProductId] = React.useState<string | null>(null)
  const [optionId, setOptionId] = React.useState<string | null>(null)
  const [supplierId, setSupplierId] = React.useState<string | null>(null)
  const [productCategoryId, setProductCategoryId] = React.useState<string | null>(null)
  const [personId, setPersonId] = React.useState<string | null>(null)
  const [organizationId, setOrganizationId] = React.useState<string | null>(null)
  const [dateRange, setDateRange] = React.useState<{
    from: string | null
    to: string | null
  } | null>(null)
  const [paxMin, setPaxMin] = React.useState<string>("")
  const [paxMax, setPaxMax] = React.useState<string>("")
  const [sortBy, setSortBy] = React.useState<BookingsListSortField>("createdAt")
  const [sortDir, setSortDir] = React.useState<BookingsListSortDir>("desc")
  const [offset, setOffset] = React.useState(0)
  const [filterPopoverOpen, setFilterPopoverOpen] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingRecord | undefined>(undefined)
  const { formatDateTime, formatNumber } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

  const paxMinNumber = paxMin === "" ? undefined : Number.parseInt(paxMin, 10)
  const paxMaxNumber = paxMax === "" ? undefined : Number.parseInt(paxMax, 10)

  const { data, isPending, isFetching, isError } = useBookings({
    search: search || undefined,
    status: status === BOOKING_STATUS_ALL ? undefined : status,
    productId: productId ?? undefined,
    optionId: optionId ?? undefined,
    supplierId: supplierId ?? undefined,
    productCategoryId: productCategoryId ?? undefined,
    personId: personId ?? undefined,
    organizationId: organizationId ?? undefined,
    dateFrom: dateRange?.from ?? undefined,
    dateTo: dateRange?.to ?? undefined,
    paxMin: Number.isFinite(paxMinNumber) ? paxMinNumber : undefined,
    paxMax: Number.isFinite(paxMaxNumber) ? paxMaxNumber : undefined,
    sortBy,
    sortDir,
    limit: pageSize,
    offset,
  })

  const bookings = data?.data ?? []
  const total = data?.total ?? 0
  const page = Math.floor(offset / pageSize) + 1
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const showSkeleton = isPending || (isFetching && bookings.length === 0)

  const handleSelect = (booking: BookingRecord) => {
    if (onSelectBooking) {
      onSelectBooking(booking)
      return
    }
    setEditing(booking)
    setDialogOpen(true)
  }

  const resetOffset = () => setOffset(0)

  const handleSort = (field: SortableField) => {
    setOffset(0)
    if (sortBy !== field) {
      setSortBy(field)
      setSortDir("asc")
      return
    }
    if (sortDir === "asc") {
      setSortDir("desc")
      return
    }
    setSortBy("createdAt")
    setSortDir("desc")
  }

  const activeFilterCount =
    (status !== BOOKING_STATUS_ALL ? 1 : 0) +
    (productId !== null ? 1 : 0) +
    (optionId !== null ? 1 : 0) +
    (supplierId !== null ? 1 : 0) +
    (productCategoryId !== null ? 1 : 0) +
    (personId !== null ? 1 : 0) +
    (organizationId !== null ? 1 : 0) +
    (dateRange?.from || dateRange?.to ? 1 : 0) +
    (paxMin !== "" || paxMax !== "" ? 1 : 0)
  const hasActiveFilters = activeFilterCount > 0 || search !== ""

  const clearFilters = () => {
    setSearch("")
    setStatus(BOOKING_STATUS_ALL)
    setProductId(null)
    setOptionId(null)
    setSupplierId(null)
    setProductCategoryId(null)
    setPersonId(null)
    setOrganizationId(null)
    setDateRange(null)
    setPaxMin("")
    setPaxMax("")
    resetOffset()
  }

  const filterMessages = messages.bookingList.filters
  const columnMessages = messages.bookingList.columns
  const statusLabels = messages.common.bookingStatusLabels

  return (
    <div data-slot="booking-list" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Label htmlFor="bookings-search" className="sr-only">
            {messages.bookingList.searchPlaceholder}
          </Label>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="bookings-search"
            placeholder={messages.bookingList.searchPlaceholder}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              resetOffset()
            }}
            className="pl-9"
          />
        </div>

        <BookingListFiltersPopover
          open={filterPopoverOpen}
          onOpenChange={setFilterPopoverOpen}
          activeFilterCount={activeFilterCount}
          status={status}
          onStatusChange={setStatus}
          productId={productId}
          onProductIdChange={setProductId}
          optionId={optionId}
          onOptionIdChange={setOptionId}
          supplierId={supplierId}
          onSupplierIdChange={setSupplierId}
          productCategoryId={productCategoryId}
          onProductCategoryIdChange={setProductCategoryId}
          personId={personId}
          onPersonIdChange={setPersonId}
          organizationId={organizationId}
          onOrganizationIdChange={setOrganizationId}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          paxMin={paxMin}
          onPaxMinChange={setPaxMin}
          paxMax={paxMax}
          onPaxMaxChange={setPaxMax}
          onFiltersChanged={resetOffset}
        />

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 size-4" />
            {filterMessages.clear}
          </Button>
        )}

        <div className="ml-auto">
          <Button
            onClick={() => {
              setEditing(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" />
            {messages.bookingList.newBooking}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortHeader
                  label={columnMessages.bookingNumber}
                  field={SORTABLE_COLUMNS.bookingNumber}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>{columnMessages.whatBooked}</TableHead>
              <TableHead>
                <SortHeader
                  label={columnMessages.status}
                  field={SORTABLE_COLUMNS.status}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label={columnMessages.sellAmount}
                  field={SORTABLE_COLUMNS.sellAmount}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label={columnMessages.pax}
                  field={SORTABLE_COLUMNS.pax}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label={columnMessages.startDate}
                  field={SORTABLE_COLUMNS.startDate}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label={columnMessages.endDate}
                  field={SORTABLE_COLUMNS.endDate}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              <BookingTableSkeleton rows={SKELETON_ROW_COUNT} />
            ) : isError ? (
              <TableRow>
                <TableCell
                  colSpan={TABLE_COLUMN_COUNT}
                  className="h-24 text-center text-sm text-destructive"
                >
                  {messages.bookingList.loadingError}
                </TableCell>
              </TableRow>
            ) : bookings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={TABLE_COLUMN_COUNT}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {messages.bookingList.empty}
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => (
                <TableRow
                  key={booking.id}
                  onClick={() => handleSelect(booking)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{booking.bookingNumber}</TableCell>
                  <TableCell>
                    {formatBookingItems(booking, messages.bookingList.itemsMore)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={bookingStatusBadgeVariant[booking.status]}>
                      {statusLabels[booking.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {booking.sellAmountCents == null
                      ? "—"
                      : `${formatNumber(booking.sellAmountCents / 100, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} ${booking.sellCurrency}`}
                  </TableCell>
                  <TableCell>{booking.pax ?? "—"}</TableCell>
                  <TableCell>
                    {formatBookingDateTime(booking.startsAt ?? booking.startDate, formatDateTime)}
                  </TableCell>
                  <TableCell>
                    {formatBookingDateTime(booking.endsAt ?? booking.endDate, formatDateTime)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {formatMessage(messages.bookingList.showingSummary, {
            count: bookings.length,
            total,
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
          >
            {messages.bookingList.previousPage}
          </Button>
          <span>
            {formatMessage(messages.bookingList.pageSummary, {
              page,
              pageCount,
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + pageSize >= total}
            onClick={() => setOffset((prev) => prev + pageSize)}
          >
            {messages.bookingList.nextPage}
          </Button>
        </div>
      </div>

      <BookingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        booking={editing}
        onSuccess={(booking) => {
          onSelectBooking?.(booking)
        }}
      />
    </div>
  )
}

interface SortHeaderProps {
  label: string
  field: SortableField
  sortBy: BookingsListSortField
  sortDir: BookingsListSortDir
  onSort: (field: SortableField) => void
}

function SortHeader({ label, field, sortBy, sortDir, onSort }: SortHeaderProps) {
  const active = sortBy === field
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="-ml-2 inline-flex h-8 items-center gap-1 rounded-sm px-2 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span>{label}</span>
      <Icon
        className={`size-3.5 ${active ? "text-foreground" : "text-muted-foreground/60"}`}
        aria-hidden
      />
    </button>
  )
}

function BookingTableSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: because skeleton placeholders are stable
        <TableRow key={`skeleton-${idx}`}>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-8" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

function formatBookingItems(booking: BookingRecord, moreTemplate: string): React.ReactNode {
  const items = booking.items ?? []
  if (items.length === 0) return <span className="text-muted-foreground">—</span>
  const [first, ...rest] = items
  if (!first) return <span className="text-muted-foreground">—</span>
  const label = first.productName ?? first.title
  if (rest.length === 0) return label
  return (
    <span>
      {label}
      <span className="ml-1 text-xs text-muted-foreground">
        {formatMessage(moreTemplate, { count: rest.length })}
      </span>
    </span>
  )
}

function formatBookingDateTime(
  value: string | null | undefined,
  formatDateTime: (value: Date | string | number) => string,
) {
  if (!value) return "—"
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatDateTime(`${value}T00:00:00`)
  }
  return formatDateTime(value)
}
