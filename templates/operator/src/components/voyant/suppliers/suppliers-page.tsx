import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { formatMessage } from "@voyantjs/admin"
import {
  SUPPLIER_STATUSES,
  SUPPLIER_TYPES,
  type SuppliersListSortDir,
  type SuppliersListSortField,
} from "@voyantjs/suppliers-react"
import { Badge, Button, Input } from "@voyantjs/ui/components"
import { CountryCombobox } from "@voyantjs/ui/components/country-combobox"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
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
import { useAdminMessages } from "@/lib/admin-i18n"
import {
  getSupplierStatusLabel,
  getSuppliersQueryOptions,
  getSupplierTypeLabel,
  statusVariant,
} from "./shared"
import { SupplierDialog } from "./supplier-dialog"

const PAGE_SIZE = 25
const STATUS_ALL = "__all__"
const TYPE_ALL = "__all__"
const SKELETON_ROW_COUNT = 8
const TABLE_COLUMN_COUNT = 6

type SortableField = Exclude<SuppliersListSortField, "createdAt">

const SORTABLE_COLUMNS = {
  name: "name",
  type: "type",
  status: "status",
  defaultCurrency: "defaultCurrency",
} as const satisfies Partial<Record<SortableField, SortableField>>

export function SuppliersPage() {
  const navigate = useNavigate()
  const messages = useAdminMessages()
  const supplierMessages = messages.suppliers

  const [search, setSearch] = useState("")
  const [type, setType] = useState<string>(TYPE_ALL)
  const [status, setStatus] = useState<string>(STATUS_ALL)
  const [country, setCountry] = useState<string | null>(null)
  const [currency, setCurrency] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SuppliersListSortField>("createdAt")
  const [sortDir, setSortDir] = useState<SuppliersListSortDir>("desc")
  const [pageIndex, setPageIndex] = useState(0)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isPending, isFetching, isError, refetch } = useQuery(
    getSuppliersQueryOptions({
      search: search || undefined,
      type: type === TYPE_ALL ? undefined : type,
      status: status === STATUS_ALL ? undefined : status,
      country: country ?? undefined,
      defaultCurrency: currency ?? undefined,
      sortBy,
      sortDir,
      limit: PAGE_SIZE,
      offset: pageIndex * PAGE_SIZE,
    }),
  )

  const suppliers = data?.data ?? []
  const total = data?.total ?? 0
  const page = pageIndex + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const showSkeleton = isPending || (isFetching && suppliers.length === 0)

  const resetPage = () => setPageIndex(0)

  const handleSort = (field: SortableField) => {
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
    (type !== TYPE_ALL ? 1 : 0) +
    (status !== STATUS_ALL ? 1 : 0) +
    (country !== null ? 1 : 0) +
    (currency !== null ? 1 : 0)
  const hasActiveFilters = activeFilterCount > 0 || search !== ""

  const clearFilters = () => {
    setSearch("")
    setType(TYPE_ALL)
    setStatus(STATUS_ALL)
    setCountry(null)
    setCurrency(null)
    resetPage()
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{supplierMessages.title}</h1>
          <p className="text-sm text-muted-foreground">{supplierMessages.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Label htmlFor="suppliers-search" className="sr-only">
            {supplierMessages.searchPlaceholder}
          </Label>
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="suppliers-search"
            placeholder={supplierMessages.searchPlaceholder}
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
                {supplierMessages.filtersButton}
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
                <Label htmlFor="suppliers-filter-type">{supplierMessages.filtersTypeLabel}</Label>
                <Select
                  value={type}
                  onValueChange={(value) => {
                    setType(value ?? TYPE_ALL)
                    resetPage()
                  }}
                >
                  <SelectTrigger id="suppliers-filter-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TYPE_ALL}>{supplierMessages.filtersTypeAll}</SelectItem>
                    {SUPPLIER_TYPES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {getSupplierTypeLabel(option.value, messages)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="suppliers-filter-status">
                  {supplierMessages.filtersStatusLabel}
                </Label>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value ?? STATUS_ALL)
                    resetPage()
                  }}
                >
                  <SelectTrigger id="suppliers-filter-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STATUS_ALL}>{supplierMessages.filtersStatusAll}</SelectItem>
                    {SUPPLIER_STATUSES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {getSupplierStatusLabel(option.value, messages)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{supplierMessages.filtersCountryLabel}</Label>
                <CountryCombobox
                  value={country}
                  onChange={(value) => {
                    setCountry(value)
                    resetPage()
                  }}
                  placeholder={supplierMessages.filtersCountryAny}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{supplierMessages.filtersCurrencyLabel}</Label>
                <CurrencyCombobox
                  value={currency}
                  onChange={(value) => {
                    setCurrency(value)
                    resetPage()
                  }}
                  placeholder={supplierMessages.filtersCurrencyAny}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 size-4" aria-hidden="true" />
            {supplierMessages.filtersClear}
          </Button>
        )}

        <div className="ml-auto">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 size-4" aria-hidden="true" />
            {supplierMessages.newSupplier}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortHeader
                  label={supplierMessages.nameColumn}
                  field={SORTABLE_COLUMNS.name}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label={supplierMessages.typeColumn}
                  field={SORTABLE_COLUMNS.type}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label={supplierMessages.statusColumn}
                  field={SORTABLE_COLUMNS.status}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>{supplierMessages.cityColumn}</TableHead>
              <TableHead>{supplierMessages.countryColumn}</TableHead>
              <TableHead>
                <SortHeader
                  label={supplierMessages.currencyColumn}
                  field={SORTABLE_COLUMNS.defaultCurrency}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              <SuppliersTableRowSkeleton rows={SKELETON_ROW_COUNT} />
            ) : isError ? (
              <TableRow>
                <TableCell
                  colSpan={TABLE_COLUMN_COUNT}
                  className="h-24 text-center text-sm text-destructive"
                >
                  {supplierMessages.loadFailed}
                </TableCell>
              </TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={TABLE_COLUMN_COUNT}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {supplierMessages.empty}
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => (
                <TableRow
                  key={supplier.id}
                  onClick={() => {
                    void navigate({ to: "/suppliers/$id", params: { id: supplier.id } })
                  }}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getSupplierTypeLabel(supplier.type, messages)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[supplier.status] ?? "secondary"}>
                      {getSupplierStatusLabel(supplier.status, messages)}
                    </Badge>
                  </TableCell>
                  <TableCell>{supplier.city ?? "—"}</TableCell>
                  <TableCell>{supplier.country ?? "—"}</TableCell>
                  <TableCell>{supplier.defaultCurrency ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {formatMessage(supplierMessages.paginationShowing, { count: suppliers.length, total })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
          >
            {supplierMessages.paginationPrevious}
          </Button>
          <span>{formatMessage(supplierMessages.paginationPage, { page, pageCount })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={(pageIndex + 1) * PAGE_SIZE >= total}
            onClick={() => setPageIndex((prev) => prev + 1)}
          >
            {supplierMessages.paginationNext}
          </Button>
        </div>
      </div>

      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false)
          void refetch()
        }}
      />
    </div>
  )
}

interface SortHeaderProps {
  label: string
  field: SortableField
  sortBy: SuppliersListSortField
  sortDir: SuppliersListSortDir
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

function SuppliersTableRowSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders are stable
        <TableRow key={`skeleton-${idx}`}>
          <TableCell>
            <Skeleton className="h-4 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-12" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
