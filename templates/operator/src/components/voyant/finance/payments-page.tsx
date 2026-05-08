import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  type FinanceAllPaymentsListSortDir,
  type FinanceAllPaymentsListSortField,
  type FinancePaymentKind,
  useAllPayments,
} from "@voyantjs/finance-react"
import type { Supplier } from "@voyantjs/suppliers-react"
import { AsyncCombobox } from "@voyantjs/ui/components/async-combobox"
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
import { getSuppliersQueryOptions } from "@/components/voyant/suppliers/shared"
import { type AdminMessages, useAdminMessages } from "@/lib/admin-i18n"
import { formatAmount, paymentStatusVariant } from "./finance-shared"
import { PaginationBar, SortHeader } from "./finance-table-helpers"
import { RecordPaymentDialog } from "./record-payment-dialog"

const PAGE_SIZE = 25
const KIND_ALL = "__all__"
const STATUS_ALL = "__all__"
const METHOD_ALL = "__all__"

const PAYMENT_KINDS: FinancePaymentKind[] = ["customer", "supplier"]
const PAYMENT_STATUSES = ["pending", "completed", "failed", "refunded"] as const
const PAYMENT_METHODS = [
  "bank_transfer",
  "credit_card",
  "debit_card",
  "cash",
  "cheque",
  "wallet",
  "direct_bill",
  "voucher",
  "other",
] as const

type PaymentSortableField = Exclude<FinanceAllPaymentsListSortField, "createdAt">

function getPaymentStatusLabel(messages: AdminMessages, status: string): string {
  switch (status) {
    case "pending":
      return messages.finance.paymentStatusPending
    case "completed":
      return messages.finance.paymentStatusCompleted
    case "failed":
      return messages.finance.paymentStatusFailed
    case "refunded":
      return messages.finance.paymentStatusRefunded
    default:
      return status.replace(/_/g, " ")
  }
}

function getPaymentMethodLabel(messages: AdminMessages, method: string): string {
  switch (method) {
    case "bank_transfer":
      return messages.finance.paymentMethodBankTransfer
    case "credit_card":
      return messages.finance.paymentMethodCreditCard
    case "debit_card":
      return messages.finance.paymentMethodDebitCard
    case "cash":
      return messages.finance.paymentMethodCash
    case "cheque":
      return messages.finance.paymentMethodCheque
    case "wallet":
      return messages.finance.paymentMethodWallet
    case "direct_bill":
      return messages.finance.paymentMethodDirectBill
    case "voucher":
      return messages.finance.paymentMethodVoucher
    case "other":
      return messages.finance.paymentMethodOther
    default:
      return method.replace(/_/g, " ")
  }
}

function getKindLabel(messages: AdminMessages, kind: FinancePaymentKind): string {
  return kind === "customer" ? messages.finance.kindCustomer : messages.finance.kindSupplier
}

export function PaymentsPage() {
  const messages = useAdminMessages()
  const navigate = useNavigate()
  const [recordDialogOpen, setRecordDialogOpen] = useState(false)

  const [search, setSearch] = useState("")
  const [kind, setKind] = useState<string>(KIND_ALL)
  const [status, setStatus] = useState<string>(STATUS_ALL)
  const [method, setMethod] = useState<string>(METHOD_ALL)
  const [currency, setCurrency] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierSearch, setSupplierSearch] = useState("")
  const [paymentDateRange, setPaymentDateRange] = useState<{
    from: string | null
    to: string | null
  } | null>(null)
  const [sortBy, setSortBy] = useState<FinanceAllPaymentsListSortField>("createdAt")
  const [sortDir, setSortDir] = useState<FinanceAllPaymentsListSortDir>("desc")
  const [pageIndex, setPageIndex] = useState(0)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)

  const { data, isPending, isFetching, isError } = useAllPayments({
    search: search || undefined,
    kind: kind === KIND_ALL ? undefined : (kind as FinancePaymentKind),
    status: status === STATUS_ALL ? undefined : status,
    paymentMethod: method === METHOD_ALL ? undefined : method,
    currency: currency ?? undefined,
    supplierId: supplierId ?? undefined,
    paymentDateFrom: paymentDateRange?.from ?? undefined,
    paymentDateTo: paymentDateRange?.to ?? undefined,
    sortBy,
    sortDir,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })

  // Supplier picker is a side filter — load suppliers lazily for the
  // combobox. Mirrors the previous supplier-payments page behaviour.
  const { data: suppliersData } = useQuery(
    getSuppliersQueryOptions({ search: supplierSearch || undefined, limit: 20 }),
  )
  const suppliers = suppliersData?.data ?? []

  const payments = data?.data ?? []
  const total = data?.total ?? 0
  const page = pageIndex + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const showSkeleton = isPending || (isFetching && payments.length === 0)

  const resetPage = () => setPageIndex(0)

  const handleSort = (field: PaymentSortableField) => {
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
    (kind !== KIND_ALL ? 1 : 0) +
    (status !== STATUS_ALL ? 1 : 0) +
    (method !== METHOD_ALL ? 1 : 0) +
    (currency !== null ? 1 : 0) +
    (supplierId !== null ? 1 : 0) +
    (paymentDateRange?.from || paymentDateRange?.to ? 1 : 0)
  const hasActiveFilters = activeFilterCount > 0 || search !== ""

  const clearFilters = () => {
    setSearch("")
    setKind(KIND_ALL)
    setStatus(STATUS_ALL)
    setMethod(METHOD_ALL)
    setCurrency(null)
    setSupplierId(null)
    setSelectedSupplier(null)
    setSupplierSearch("")
    setPaymentDateRange(null)
    resetPage()
  }

  const f = messages.finance
  const noValue = f.detailSections.noValue

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{f.paymentsPageTitle}</h1>
          <p className="text-sm text-muted-foreground">{f.paymentsPageDescription}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Label htmlFor="payments-search" className="sr-only">
              {f.searchPaymentsPlaceholder}
            </Label>
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="payments-search"
              placeholder={f.searchPaymentsPlaceholder}
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
                  <Label htmlFor="payments-filter-kind">{f.filtersKindLabel}</Label>
                  <Select
                    value={kind}
                    onValueChange={(value) => {
                      setKind(value ?? KIND_ALL)
                      resetPage()
                    }}
                  >
                    <SelectTrigger id="payments-filter-kind" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={KIND_ALL}>{f.filtersKindAll}</SelectItem>
                      {PAYMENT_KINDS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {getKindLabel(messages, value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="payments-filter-status">{f.filtersStatusLabel}</Label>
                  <Select
                    value={status}
                    onValueChange={(value) => {
                      setStatus(value ?? STATUS_ALL)
                      resetPage()
                    }}
                  >
                    <SelectTrigger id="payments-filter-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={STATUS_ALL}>{f.filtersStatusAll}</SelectItem>
                      {PAYMENT_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {getPaymentStatusLabel(messages, value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="payments-filter-method">{f.filtersMethodLabel}</Label>
                  <Select
                    value={method}
                    onValueChange={(value) => {
                      setMethod(value ?? METHOD_ALL)
                      resetPage()
                    }}
                  >
                    <SelectTrigger id="payments-filter-method" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={METHOD_ALL}>{f.filtersMethodAll}</SelectItem>
                      {PAYMENT_METHODS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {getPaymentMethodLabel(messages, value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>{f.filtersSupplierLabel}</Label>
                  <AsyncCombobox<Supplier>
                    value={supplierId}
                    onChange={(value) => {
                      setSupplierId(value)
                      if (!value) setSelectedSupplier(null)
                      else {
                        const match = suppliers.find((s) => s.id === value)
                        if (match) setSelectedSupplier(match)
                      }
                      resetPage()
                    }}
                    items={suppliers}
                    selectedItem={selectedSupplier}
                    getKey={(s) => s.id}
                    getLabel={(s) => s.name}
                    onSearchChange={setSupplierSearch}
                    placeholder={f.filtersSupplierAny}
                    emptyText={f.filtersSupplierEmpty}
                  />
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
                  <Label>{f.filtersPaymentDateLabel}</Label>
                  <DateRangePicker
                    value={paymentDateRange}
                    onChange={(value) => {
                      setPaymentDateRange(value)
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
            <Button onClick={() => setRecordDialogOpen(true)}>
              <Plus className="mr-2 size-4" aria-hidden="true" />
              {f.recordPayment}
            </Button>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{f.kindColumn}</TableHead>
                <TableHead>{f.referenceColumn}</TableHead>
                <TableHead>{f.partyColumn}</TableHead>
                <TableHead>
                  <SortHeader
                    label={f.amountColumn}
                    field="amountCents"
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
                    label={f.dateColumn}
                    field="paymentDate"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>{f.filtersMethodLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showSkeleton ? (
                <PaymentRowSkeleton rows={6} />
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-destructive">
                    {f.loadFailed}
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                    {f.empty}
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((row) => {
                  // Surface the human reference (invoice/booking number)
                  // first, then the payment's own external ref number for
                  // operator recognition. Never the typeid.
                  const reference = row.kind === "customer" ? row.invoiceNumber : row.bookingNumber
                  // "Paid by" for customer rows (person → fallback org); "paid to"
                  // for supplier rows. Operators read the party, not raw ids.
                  const party =
                    row.kind === "supplier"
                      ? (row.supplierName ?? noValue)
                      : (row.personName ?? row.organizationName ?? noValue)
                  return (
                    <TableRow
                      key={`${row.kind}-${row.id}`}
                      onClick={() =>
                        void navigate({
                          to: "/finance/payments/$id",
                          params: { id: row.id },
                        })
                      }
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {getKindLabel(messages, row.kind)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{reference ?? noValue}</span>
                          {row.referenceNumber ? (
                            <span className="text-xs text-muted-foreground">
                              {row.referenceNumber}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{party}</TableCell>
                      <TableCell className="font-mono">
                        {formatAmount(row.amountCents, row.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={paymentStatusVariant[row.status] ?? "secondary"}
                          className="capitalize"
                        >
                          {getPaymentStatusLabel(messages, row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.paymentDate}</TableCell>
                      <TableCell className="capitalize">
                        {getPaymentMethodLabel(messages, row.paymentMethod)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <PaginationBar
          messages={messages}
          shown={payments.length}
          total={total}
          page={page}
          pageCount={pageCount}
          onPrevious={() => setPageIndex((prev) => Math.max(0, prev - 1))}
          onNext={() => setPageIndex((prev) => prev + 1)}
          canGoBack={pageIndex > 0}
          canGoForward={(pageIndex + 1) * PAGE_SIZE < total}
        />
      </div>

      <RecordPaymentDialog
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
        defaultKind={kind === KIND_ALL ? "customer" : (kind as FinancePaymentKind)}
      />
    </div>
  )
}

function PaymentRowSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders are stable
        <TableRow key={`skeleton-${idx}`}>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
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
            <Skeleton className="h-4 w-32" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
