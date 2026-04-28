"use client"

import { type ProductRecord, useProducts } from "@voyantjs/products-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { formatMessage } from "@voyantjs/voyant-admin"
import { Plus, Search } from "lucide-react"
import * as React from "react"
import { SkeletonTableRows } from "@/components/ui/skeletons"
import { useAdminMessages } from "@/lib/admin-i18n"
import { getProductStatusLabel } from "./product-detail-shared"
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

function formatAmount(cents: number | null, currency: string, fallback: string): string {
  if (cents == null) return fallback
  return `${(cents / 100).toFixed(2)} ${currency}`
}

export function ProductList({ pageSize = 25, onSelectProduct }: ProductListProps = {}) {
  const messages = useAdminMessages()
  const productMessages = messages.products.core
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

  return (
    <div data-slot="product-list" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder={productMessages.searchPlaceholder}
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
          {productMessages.newProduct}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{productMessages.tableName}</TableHead>
              <TableHead>{productMessages.tableStatus}</TableHead>
              <TableHead>{productMessages.tableSellAmount}</TableHead>
              <TableHead>{productMessages.tablePax}</TableHead>
              <TableHead>{productMessages.tableStartDate}</TableHead>
            </TableRow>
          </TableHeader>
          {isPending ? (
            <SkeletonTableRows
              rows={6}
              columns={5}
              columnWidths={["w-48", "w-16", "w-24", "w-8", "w-24"]}
            />
          ) : isError ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-destructive">
                  {productMessages.loadFailed}
                </TableCell>
              </TableRow>
            </TableBody>
          ) : products.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  {productMessages.empty}
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product.id}
                  onClick={() => handleEdit(product)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[product.status] ?? "secondary"}>
                      {getProductStatusLabel(product.status, messages)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatAmount(
                      product.sellAmountCents,
                      product.sellCurrency,
                      productMessages.noValue,
                    )}
                  </TableCell>
                  <TableCell>{product.pax ?? productMessages.noValue}</TableCell>
                  <TableCell>{product.startDate ?? productMessages.noValue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {formatMessage(productMessages.paginationShowing, { count: products.length, total })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
          >
            {productMessages.paginationPrevious}
          </Button>
          <span>{formatMessage(productMessages.paginationPage, { page, pageCount })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + pageSize >= total}
            onClick={() => setOffset((prev) => prev + pageSize)}
          >
            {productMessages.paginationNext}
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
