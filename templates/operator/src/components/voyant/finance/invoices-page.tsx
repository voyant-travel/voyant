import { useNavigate } from "@tanstack/react-router"
import {
  type FinanceInvoiceListSortDir,
  type FinanceInvoiceListSortField,
  useInvoices,
} from "@voyantjs/finance-react"
import { InvoiceDialog } from "@voyantjs/finance-ui/components/invoice-dialog"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { DateRangePicker } from "@voyantjs/ui/components/date-picker"
import { Label } from "@voyantjs/ui/components/label"
import { Popover, PopoverContent, PopoverTrigger } from "@voyantjs/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { ListFilter, Plus, Search, X } from "lucide-react"
import { useState } from "react"
import { Badge, Button, Input } from "@/components/ui"
import { type AdminMessages, useAdminMessages } from "@/lib/admin-i18n"
import { formatAmount, type InvoiceRow, invoiceStatusVariant } from "./finance-shared"
import { PaginationBar, SortHeader } from "./finance-table-helpers"

const PAGE_SIZE = 25
const STATUS_ALL = "__all__"
const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "overdue", "void"] as const

type InvoiceSortableField = Exclude<FinanceInvoiceListSortField, "createdAt">

function getInvoiceStatusLabel(messages: AdminMessages, status: string): string {
  switch (status) {
    case "draft":
      return messages.finance.invoiceStatusDraft
    case "sent":
      return messages.finance.invoiceStatusSent
    case "partially_paid":
      return messages.finance.invoiceStatusPartiallyPaid
    case "paid":
      return messages.finance.invoiceStatusPaid
    case "overdue":
      return messages.finance.invoiceStatusOverdue
    case "void":
      return messages.finance.invoiceStatusVoid
    default:
      return status.replace(/_/g, " ")
  }
}

export function InvoicesPage() {
  const messages = useAdminMessages()
  const navigate = useNavigate()
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>(STATUS_ALL)
  const [currency, setCurrency] = useState<string | null>(null)
  const [dueDateRange, setDueDateRange] = useState<{
    from: string | null
    to: string | null
  } | null>(null)
  const [sortBy, setSortBy] = useState<FinanceInvoiceListSortField>("createdAt")
  const [sortDir, setSortDir] = useState<FinanceInvoiceListSortDir>("desc")
  const [pageIndex, setPageIndex] = useState(0)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)

  const { data, isPending, isFetching, isError } = useInvoices({
    search: search || undefined,
    status: status === STATUS_ALL ? undefined : status,
    currency: currency ?? undefined,
    dueDateFrom: dueDateRange?.from ?? undefined,
    dueDateTo: dueDateRange?.to ?? undefined,
    sortBy,
    sortDir,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })

  const invoices = data?.data ?? []
  const total = data?.total ?? 0
  const page = pageIndex + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const showSkeleton = isPending || (isFetching && invoices.length === 0)

  const resetPage = () => setPageIndex(0)

  const handleSort = (field: InvoiceSortableField) => {
    resetPage()
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
    (status !== STATUS_ALL ? 1 : 0) +
    (currency !== null ? 1 : 0) +
    (dueDateRange?.from || dueDateRange?.to ? 1 : 0)
  const hasActiveFilters = activeFilterCount > 0 || search !== ""

  const clearFilters = () => {
    setSearch("")
    setStatus(STATUS_ALL)
    setCurrency(null)
    setDueDateRange(null)
    resetPage()
  }

  const f = messages.finance

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{f.invoicesPageTitle}</h1>
          <p className="text-sm text-muted-foreground">{f.invoicesPageDescription}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Label htmlFor="invoices-search" className="sr-only">
              {f.searchInvoicesPlaceholder}
            </Label>
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="invoices-search"
              placeholder={f.searchInvoicesPlaceholder}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                resetPage()
              }}
              className="pl-9"
            />
          </div>

          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" size="default">
                  <ListFilter className="mr-2 size-4" aria-hidden="true" />
                  {f.filtersButton}
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2 px-1.5">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              }
            />
            <PopoverContent align="start" className="w-[24rem] p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invoices-filter-status">{f.filtersStatusLabel}</Label>
                  <Select
                    value={status}
                    onValueChange={(value) => {
                      setStatus(value ?? STATUS_ALL)
                      resetPage()
                    }}
                  >
                    <SelectTrigger id="invoices-filter-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={STATUS_ALL}>{f.filtersStatusAll}</SelectItem>
                      {INVOICE_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {getInvoiceStatusLabel(messages, value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>{f.filtersCurrencyLabel}</Label>
                  <CurrencyCombobox
                    value={currency}
                    onChange={(value) => {
                      setCurrency(value)
                      resetPage()
                    }}
                    placeholder={f.filtersCurrencyAny}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>{f.filtersDueDateLabel}</Label>
                  <DateRangePicker
                    value={dueDateRange}
                    onChange={(value) => {
                      setDueDateRange(value)
                      resetPage()
                    }}
                    placeholder={f.filtersDateAny}
                    clearable
                    className="w-full"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 size-4" aria-hidden="true" />
              {f.filtersClear}
            </Button>
          )}

          <div className="ml-auto">
            <Button onClick={() => setInvoiceDialogOpen(true)}>
              <Plus className="mr-2 size-4" aria-hidden="true" />
              {f.newInvoice}
            </Button>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortHeader
                    label={f.invoiceNumberColumn}
                    field="invoiceNumber"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label={f.statusColumn}
                    field="status"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label={f.totalColumn}
                    field="totalCents"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label={f.paidColumn}
                    field="paidCents"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label={f.balanceDueColumn}
                    field="balanceDueCents"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label={f.dueDateColumn}
                    field="dueDate"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showSkeleton ? (
                <InvoiceRowSkeleton rows={6} />
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-destructive">
                    {f.loadFailed}
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    {f.empty}
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((row: InvoiceRow) => (
                  <TableRow
                    key={row.id}
                    onClick={() =>
                      void navigate({
                        to: "/finance/invoices/$id",
                        params: { id: row.id },
                      })
                    }
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">{row.invoiceNumber}</TableCell>
                    <TableCell>
                      <Badge
                        variant={invoiceStatusVariant[row.status] ?? "secondary"}
                        className="capitalize"
                      >
                        {getInvoiceStatusLabel(messages, row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatAmount(row.totalCents, row.currency)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatAmount(row.paidCents, row.currency)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatAmount(row.balanceDueCents, row.currency)}
                    </TableCell>
                    <TableCell>{row.dueDate}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <PaginationBar
          messages={messages}
          shown={invoices.length}
          total={total}
          page={page}
          pageCount={pageCount}
          onPrevious={() => setPageIndex((prev) => Math.max(0, prev - 1))}
          onNext={() => setPageIndex((prev) => prev + 1)}
          canGoBack={pageIndex > 0}
          canGoForward={(pageIndex + 1) * PAGE_SIZE < total}
        />
      </div>

      <InvoiceDialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen} />
    </div>
  )
}

function InvoiceRowSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders are stable
        <TableRow key={`skeleton-${idx}`}>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
