import {
  type FinanceInvoiceListSortDir,
  type FinanceInvoiceListSortField,
  type InvoiceRecord,
  useInvoices,
} from "@voyantjs/finance-react"
import { formatMessage } from "@voyantjs/i18n"
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { DateRangePicker } from "@voyantjs/ui/components/date-picker"
import { Popover, PopoverContent, PopoverTrigger } from "@voyantjs/ui/components/popover"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { cn } from "@voyantjs/ui/lib/utils"
import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter, Plus, Search, X } from "lucide-react"
import { useState } from "react"
import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import { invoiceStatuses } from "../i18n/messages.js"
import { InvoiceDialog } from "./invoice-dialog.js"

const PAGE_SIZE = 25
const STATUS_ALL = "__all__"

type InvoiceSortableField = Exclude<FinanceInvoiceListSortField, "createdAt">

export interface InvoicesPageProps {
  className?: string
  onOpenInvoice?: (invoiceId: string) => void
}

const invoiceStatusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  partially_paid: "secondary",
  paid: "default",
  overdue: "destructive",
  void: "destructive",
}

function formatAmount(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`
}

export function InvoicesPage({ className, onOpenInvoice }: InvoicesPageProps = {}) {
  const messages = useFinanceUiMessagesOrDefault()
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

  const f = messages.invoicesPage

  return (
    <div className={cn("flex flex-col gap-6 p-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{f.title}</h1>
          <p className="text-sm text-muted-foreground">{f.description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Label htmlFor="invoices-search" className="sr-only">
              {f.searchPlaceholder}
            </Label>
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="invoices-search"
              placeholder={f.searchPlaceholder}
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
                  {f.filters.button}
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
                  <Label htmlFor="invoices-filter-status">{f.filters.statusLabel}</Label>
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
                      <SelectItem value={STATUS_ALL}>{f.filters.statusAll}</SelectItem>
                      {invoiceStatuses.map((value) => (
                        <SelectItem key={value} value={value}>
                          {messages.common.invoiceStatusLabels[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>{f.filters.currencyLabel}</Label>
                  <CurrencyCombobox
                    value={currency}
                    onChange={(value) => {
                      setCurrency(value)
                      resetPage()
                    }}
                    placeholder={f.filters.currencyAny}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>{f.filters.dueDateLabel}</Label>
                  <DateRangePicker
                    value={dueDateRange}
                    onChange={(value) => {
                      setDueDateRange(value)
                      resetPage()
                    }}
                    placeholder={f.filters.dateAny}
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
              {f.filters.clear}
            </Button>
          )}

          <div className="ml-auto">
            <Button onClick={() => setInvoiceDialogOpen(true)}>
              <Plus className="mr-2 size-4" aria-hidden="true" />
              {f.actions.newInvoice}
            </Button>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortHeader
                    label={f.columns.invoiceNumber}
                    field="invoiceNumber"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label={f.columns.status}
                    field="status"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label={f.columns.total}
                    field="totalCents"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label={f.columns.paid}
                    field="paidCents"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label={f.columns.balanceDue}
                    field="balanceDueCents"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label={f.columns.dueDate}
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
                invoices.map((row: InvoiceRecord) => (
                  <TableRow
                    key={row.id}
                    onClick={() => onOpenInvoice?.(row.id)}
                    className={cn(onOpenInvoice && "cursor-pointer")}
                  >
                    <TableCell className="font-medium">{row.invoiceNumber}</TableCell>
                    <TableCell>
                      <Badge
                        variant={invoiceStatusVariant[row.status] ?? "secondary"}
                        className="capitalize"
                      >
                        {messages.common.invoiceStatusLabels[row.status] ?? row.status}
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

interface SortHeaderProps<TField extends string> {
  label: string
  field: TField
  sortBy: string
  sortDir: "asc" | "desc"
  onSort: (field: TField) => void
}

function SortHeader<TField extends string>({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
}: SortHeaderProps<TField>) {
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

function PaginationBar({
  shown,
  total,
  page,
  pageCount,
  onPrevious,
  onNext,
  canGoBack,
  canGoForward,
}: {
  shown: number
  total: number
  page: number
  pageCount: number
  onPrevious: () => void
  onNext: () => void
  canGoBack: boolean
  canGoForward: boolean
}) {
  const messages = useFinanceUiMessagesOrDefault()
  const f = messages.invoicesPage.pagination
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{formatMessage(f.showing, { count: shown, total })}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!canGoBack} onClick={onPrevious}>
          {f.previous}
        </Button>
        <span>{formatMessage(f.page, { page, pageCount })}</span>
        <Button variant="outline" size="sm" disabled={!canGoForward} onClick={onNext}>
          {f.next}
        </Button>
      </div>
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
