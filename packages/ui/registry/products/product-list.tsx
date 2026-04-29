"use client"

import { formatMessage } from "@voyantjs/i18n"
import { type ProductRecord, useProducts } from "@voyantjs/products-react"
import { Loader2, Plus, Search } from "lucide-react"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { useRegistryProductsI18nOrDefault } from "./i18n/provider"
import { ProductDialog } from "./product-dialog"

export interface ProductListProps {
  pageSize?: number
  onSelectProduct?: (product: ProductRecord) => void
}

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  active: "default",
  archived: "secondary",
}

export function ProductList({ pageSize = 25, onSelectProduct }: ProductListProps = {}) {
  const i18n = useRegistryProductsI18nOrDefault()
  const messages = i18n.messages
  const [search, setSearch] = React.useState("")
  const [offset, setOffset] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ProductRecord | undefined>(undefined)

  const { data, isPending, isError } = useProducts({
    search: search || undefined,
    limit: pageSize,
    offset,
  })

  const products = data?.data ?? []
  const total = data?.total ?? 0
  const page = Math.floor(offset / pageSize) + 1
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const handleEdit = (product: ProductRecord) => {
    if (onSelectProduct) {
      onSelectProduct(product)
      return
    }
    setEditing(product)
    setDialogOpen(true)
  }

  const handleCreate = () => {
    setEditing(undefined)
    setDialogOpen(true)
  }

  const formatSellAmount = (cents: number | null, currency: string) => {
    if (cents == null) return messages.common.none
    return i18n.formatCurrency(cents / 100, currency)
  }

  const formatStartDate = (value: string | null) => {
    if (!value) return messages.common.none
    const parsed = new Date(value)
    return Number.isNaN(parsed.valueOf()) ? value : i18n.formatDate(parsed)
  }

  return (
    <div data-slot="product-list" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder={messages.productList.searchPlaceholder}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setOffset(0)
            }}
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreate} data-slot="product-list-create">
          <Plus className="mr-2 size-4" aria-hidden="true" />
          {messages.productList.createProduct}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.productList.columns.name}</TableHead>
              <TableHead>{messages.productList.columns.status}</TableHead>
              <TableHead>{messages.productList.columns.sellAmount}</TableHead>
              <TableHead>{messages.productList.columns.pax}</TableHead>
              <TableHead>{messages.productList.columns.startDate}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2
                    className="mx-auto size-4 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-destructive">
                  {messages.productList.loadingError}
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  {messages.productList.empty}
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow
                  key={product.id}
                  onClick={() => handleEdit(product)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[product.status] ?? "secondary"}>
                      {
                        messages.common.productStatusLabels[
                          product.status as keyof typeof messages.common.productStatusLabels
                        ]
                      }
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatSellAmount(product.sellAmountCents, product.sellCurrency)}
                  </TableCell>
                  <TableCell>{product.pax ?? messages.common.none}</TableCell>
                  <TableCell>{formatStartDate(product.startDate)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {formatMessage(messages.productList.showingSummary, {
            count: products.length,
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
            {messages.common.previous}
          </Button>
          <span>
            {messages.common.page} {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + pageSize >= total}
            onClick={() => setOffset((prev) => prev + pageSize)}
          >
            {messages.common.next}
          </Button>
        </div>
      </div>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        onSuccess={(product) => {
          if (onSelectProduct) {
            onSelectProduct(product)
          }
        }}
      />
    </div>
  )
}
