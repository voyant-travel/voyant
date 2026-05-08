import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { formatMessage } from "@voyantjs/admin"
import {
  type FinanceInvoiceListSortDir,
  type FinanceInvoiceListSortField,
  type FinanceSupplierPaymentListSortDir,
  type FinanceSupplierPaymentListSortField,
  useInvoices,
  useSupplierPayments,
} from "@voyantjs/finance-react"
import { InvoiceDialog } from "@voyantjs/finance-ui/components/invoice-dialog"
import { SupplierPaymentDialog } from "@voyantjs/finance-ui/components/supplier-payment-dialog"
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
import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter, Plus, Search, X } from "lucide-react"
import { useState } from "react"
import { Badge, Button, Input } from "@/components/ui"
import { getSuppliersQueryOptions } from "@/components/voyant/suppliers/shared"
import { type AdminMessages, useAdminMessages } from "@/lib/admin-i18n"
import {
  formatAmount,
  type InvoiceRow,
  invoiceStatusVariant,
  paymentStatusVariant,
  type SupplierPaymentRow,
} from "./finance-shared"

const PAGE_SIZE = 25
const STATUS_ALL = "__all__"
const METHOD_ALL = "__all__"

const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "overdue", "void"] as const
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

type InvoiceSortableField = Exclude<FinanceInvoiceListSortField, "createdAt">
type PaymentSortableField = Exclude<FinanceSupplierPaymentListSortField, "createdAt">

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

export function FinancePage() {
  const messages = useAdminMessages()
  const navigate = useNavigate()
  const [tab, setTab] = useState<"invoices" | "supplier-payments">("invoices")
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [supplierPaymentDialogOpen, setSupplierPaymentDialogOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{messages.finance.title}</h1>
          <p className="text-sm text-muted-foreground">{messages.finance.description}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setTab("invoices")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "invoices"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {messages.finance.invoicesTab}
        </button>
        <button
          type="button"
          onClick={() => setTab("supplier-payments")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "supplier-payments"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {messages.finance.supplierPaymentsTab}
        </button>
      </div>

      {tab === "invoices" ? (
        <InvoicesTab
          messages={messages}
          onCreate={() => setInvoiceDialogOpen(true)}
          onOpenInvoice={(id) => void navigate({ to: "/finance/invoices/$id", params: { id } })}
        />
      ) : (
        <SupplierPaymentsTab
          messages={messages}
          onCreate={() => setSupplierPaymentDialogOpen(true)}
        />
      )}

      <InvoiceDialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen} />
      <SupplierPaymentDialog
        open={supplierPaymentDialogOpen}
        onOpenChange={setSupplierPaymentDialogOpen}
      />
    </div>
  )
}

interface InvoicesTabProps {
  messages: AdminMessages
  onCreate: () => void
  onOpenInvoice: (id: string) => void
}

function InvoicesTab({ messages, onCreate, onOpenInvoice }: InvoicesTabProps) {
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
          <Button onClick={onCreate}>
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
                  onClick={() => onOpenInvoice(row.id)}
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
  )
}

interface SupplierPaymentsTabProps {
  messages: AdminMessages
  onCreate: () => void
}

function SupplierPaymentsTab({ messages, onCreate }: SupplierPaymentsTabProps) {
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
  const [sortBy, setSortBy] = useState<FinanceSupplierPaymentListSortField>("createdAt")
  const [sortDir, setSortDir] = useState<FinanceSupplierPaymentListSortDir>("desc")
  const [pageIndex, setPageIndex] = useState(0)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)

  const { data, isPending, isFetching, isError } = useSupplierPayments({
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
    (status !== STATUS_ALL ? 1 : 0) +
    (method !== METHOD_ALL ? 1 : 0) +
    (currency !== null ? 1 : 0) +
    (supplierId !== null ? 1 : 0) +
    (paymentDateRange?.from || paymentDateRange?.to ? 1 : 0)
  const hasActiveFilters = activeFilterCount > 0

  const clearFilters = () => {
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
  const noValue = messages.finance.detailSections.noValue

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
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
          <Button onClick={onCreate}>
            <Plus className="mr-2 size-4" aria-hidden="true" />
            {f.recordSupplierPayment}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{f.bookingColumn}</TableHead>
              <TableHead>{f.supplierColumn}</TableHead>
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
              <TableHead>{f.referenceColumn}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              <SupplierPaymentRowSkeleton rows={6} />
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-destructive">
                  {f.loadFailed}
                </TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  {f.empty}
                </TableCell>
              </TableRow>
            ) : (
              payments.map((row: SupplierPaymentRow) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.bookingId}</TableCell>
                  <TableCell>
                    {row.supplierId ? (
                      <span className="font-mono text-xs">{row.supplierId}</span>
                    ) : (
                      noValue
                    )}
                  </TableCell>
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
                  <TableCell>{row.referenceNumber ?? noValue}</TableCell>
                </TableRow>
              ))
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

interface PaginationBarProps {
  messages: AdminMessages
  shown: number
  total: number
  page: number
  pageCount: number
  onPrevious: () => void
  onNext: () => void
  canGoBack: boolean
  canGoForward: boolean
}

function PaginationBar({
  messages,
  shown,
  total,
  page,
  pageCount,
  onPrevious,
  onNext,
  canGoBack,
  canGoForward,
}: PaginationBarProps) {
  const f = messages.finance
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{formatMessage(f.paginationShowing, { count: shown, total })}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!canGoBack} onClick={onPrevious}>
          {f.paginationPrevious}
        </Button>
        <span>{formatMessage(f.paginationPage, { page, pageCount })}</span>
        <Button variant="outline" size="sm" disabled={!canGoForward} onClick={onNext}>
          {f.paginationNext}
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

function SupplierPaymentRowSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders are stable
        <TableRow key={`skeleton-${idx}`}>
          <TableCell>
            <Skeleton className="h-4 w-32" />
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
            <Skeleton className="h-4 w-32" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
