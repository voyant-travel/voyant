"use client"

import {
  SUPPLIER_STATUSES,
  SUPPLIER_TYPES,
  type Supplier,
  type SuppliersListSortDir,
  type SuppliersListSortField,
  statusVariant,
  useSuppliers,
} from "@voyantjs/suppliers-react"
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { ArrowDown, ArrowUp, Plus, Search, SlidersHorizontal } from "lucide-react"
import * as React from "react"
import { useSuppliersUiMessagesOrDefault } from "../i18n/index.js"
import { formatMessage } from "./message-format.js"
import { SupplierDialog } from "./supplier-dialog.js"

const ALL = "__all__"

export type SuppliersPageProps = {
  pageSize?: number
  onSupplierOpen?: (supplier: Supplier) => void
  onSupplierCreated?: (supplier: Supplier) => void
  initialSearch?: string
}

export function SuppliersPage({
  pageSize = 25,
  onSupplierOpen,
  onSupplierCreated,
  initialSearch = "",
}: SuppliersPageProps = {}) {
  const messages = useSuppliersUiMessagesOrDefault()
  const [search, setSearch] = React.useState(initialSearch)
  const [type, setType] = React.useState(ALL)
  const [status, setStatus] = React.useState(ALL)
  const [country, setCountry] = React.useState("")
  const [currency, setCurrency] = React.useState("")
  const [sortBy, setSortBy] = React.useState<SuppliersListSortField>("name")
  const [sortDir, setSortDir] = React.useState<SuppliersListSortDir>("asc")
  const [pageIndex, setPageIndex] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const query = useSuppliers({
    limit: pageSize,
    offset: pageIndex * pageSize,
    search: search || undefined,
    type: type === ALL ? undefined : type,
    status: status === ALL ? undefined : status,
    country: country || undefined,
    defaultCurrency: currency || undefined,
    sortBy,
    sortDir,
  })

  const rows = query.data?.data ?? []
  const total = query.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  function toggleSort(field: SuppliersListSortField) {
    if (sortBy === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"))
      setPageIndex(0)
      return
    }
    setSortBy(field)
    setSortDir("asc")
    setPageIndex(0)
  }

  function clearFilters() {
    setSearch("")
    setType(ALL)
    setStatus(ALL)
    setCountry("")
    setCurrency("")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{messages.suppliersPage.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{messages.suppliersPage.description}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus />
          {messages.suppliersPage.create}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPageIndex(0)
            }}
            placeholder={messages.suppliersPage.searchPlaceholder}
            className="pl-9"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_10rem_auto]">
          <Select
            value={type}
            onValueChange={(value) => {
              setType(value ?? ALL)
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{messages.suppliersPage.allTypes}</SelectItem>
              {SUPPLIER_TYPES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {messages.common.supplierTypeLabels[item.value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value ?? ALL)
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{messages.suppliersPage.allStatuses}</SelectItem>
              {SUPPLIER_STATUSES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {messages.common.supplierStatusLabels[item.value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={country}
            onChange={(event) => {
              setCountry(event.target.value.toUpperCase())
              setPageIndex(0)
            }}
            placeholder={messages.suppliersPage.countryPlaceholder}
            maxLength={2}
          />
          <Input
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value.toUpperCase())
              setPageIndex(0)
            }}
            placeholder={messages.suppliersPage.currencyPlaceholder}
            maxLength={3}
          />
          <Button type="button" variant="outline" onClick={clearFilters}>
            <SlidersHorizontal />
            {messages.suppliersPage.clearFilters}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <SortableHeader
                label={messages.suppliersPage.columns.name}
                field="name"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label={messages.suppliersPage.columns.type}
                field="type"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label={messages.suppliersPage.columns.status}
                field="status"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <th className="px-4 py-3 font-medium">{messages.suppliersPage.columns.country}</th>
              <SortableHeader
                label={messages.suppliersPage.columns.currency}
                field="defaultCurrency"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
            </tr>
          </thead>
          <tbody>
            {query.isPending ? (
              <LoadingRows columns={5} rows={8} />
            ) : query.isError ? (
              <MessageRow columns={5}>{messages.suppliersPage.loadFailed}</MessageRow>
            ) : rows.length === 0 ? (
              <MessageRow columns={5}>{messages.suppliersPage.empty}</MessageRow>
            ) : (
              rows.map((supplier) => (
                <tr
                  key={supplier.id}
                  className="border-t transition-colors hover:bg-muted/40"
                  onClick={() => onSupplierOpen?.(supplier)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{supplier.name}</div>
                    {supplier.city && (
                      <div className="text-xs text-muted-foreground">{supplier.city}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{messages.common.supplierTypeLabels[supplier.type]}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[supplier.status]}>
                      {messages.common.supplierStatusLabels[supplier.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{supplier.country ?? messages.common.none}</td>
                  <td className="px-4 py-3">{supplier.defaultCurrency ?? messages.common.none}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>{formatMessage(messages.suppliersPage.summary, { shown: rows.length, total })}</div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageIndex === 0 || query.isPending}
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
          >
            {messages.suppliersPage.previous}
          </Button>
          <span>
            {formatMessage(messages.suppliersPage.page, {
              page: pageIndex + 1,
              pageCount,
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageIndex + 1 >= pageCount || query.isPending}
            onClick={() => setPageIndex((current) => current + 1)}
          >
            {messages.suppliersPage.next}
          </Button>
        </div>
      </div>

      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={onSupplierCreated}
      />
    </div>
  )
}

function SortableHeader({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string
  field: SuppliersListSortField
  sortBy: SuppliersListSortField
  sortDir: SuppliersListSortDir
  onSort: (field: SuppliersListSortField) => void
}) {
  return (
    <th className="px-4 py-3 font-medium">
      <Button type="button" variant="ghost" size="sm" onClick={() => onSort(field)}>
        {label}
        {sortBy === field &&
          (sortDir === "asc" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />)}
      </Button>
    </th>
  )
}

function LoadingRows({ rows, columns }: { rows: number; columns: number }) {
  return Array.from({ length: rows }, (_, rowIndex) => `row-${rowIndex}`).map((rowKey) => (
    <tr key={rowKey} className="border-t">
      {Array.from({ length: columns }, (__, columnIndex) => `${rowKey}-cell-${columnIndex}`).map(
        (columnKey) => (
          <td key={columnKey} className="px-4 py-3">
            <div className="h-4 w-full max-w-32 animate-pulse rounded bg-muted" />
          </td>
        ),
      )}
    </tr>
  ))
}

function MessageRow({ columns, children }: { columns: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={columns} className="px-4 py-10 text-center text-muted-foreground">
        {children}
      </td>
    </tr>
  )
}
