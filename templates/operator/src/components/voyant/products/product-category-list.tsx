"use client"

import {
  type ProductCategoryRecord,
  useProductCategories,
  useProductCategoryMutation,
} from "@voyantjs/products-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voyantjs/ui/components/dropdown-menu"
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
import { CheckCircle2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
import * as React from "react"
import { SkeletonTableRows } from "@/components/ui/skeletons"
import { useAdminMessages } from "@/lib/admin-i18n"

import { ProductCategoryDialog } from "./product-category-dialog"

export interface ProductCategoryListProps {
  pageSize?: number
}

export function ProductCategoryList({ pageSize = 25 }: ProductCategoryListProps = {}) {
  const messages = useAdminMessages()
  const categoryMessages = messages.products.taxonomy.categories
  const [search, setSearch] = React.useState("")
  const [offset, setOffset] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ProductCategoryRecord | undefined>(undefined)
  const { data, isPending, isError } = useProductCategories({
    search: search || undefined,
    limit: pageSize,
    offset,
  })
  const { remove } = useProductCategoryMutation()

  const categories = data?.data ?? []
  const total = data?.total ?? 0
  const page = Math.floor(offset / pageSize) + 1
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  return (
    <div data-slot="product-category-list" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={categoryMessages.searchPlaceholder}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setOffset(0)
            }}
            className="pl-9"
          />
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 size-4" aria-hidden="true" />
          {categoryMessages.addCategory}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{categoryMessages.tableName}</TableHead>
              <TableHead>{categoryMessages.tableSlug}</TableHead>
              <TableHead>{categoryMessages.tableParent}</TableHead>
              <TableHead>{categoryMessages.tableStatus}</TableHead>
              <TableHead className="w-[80px] text-right">{categoryMessages.tableActions}</TableHead>
            </TableRow>
          </TableHeader>
          {isPending ? (
            <SkeletonTableRows
              rows={6}
              columns={5}
              columnWidths={["w-40", "w-32", "w-32", "w-20", "w-8"]}
            />
          ) : isError ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-destructive">
                  {categoryMessages.loadFailed}
                </TableCell>
              </TableRow>
            </TableBody>
          ) : categories.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  {categoryMessages.empty}
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>{category.slug}</TableCell>
                  <TableCell>
                    {category.parentId
                      ? (categoryById.get(category.parentId)?.name ??
                        categoryMessages.parentFallback)
                      : categoryMessages.parentFallback}
                  </TableCell>
                  <TableCell>
                    {category.active ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="size-3.5" />
                        {categoryMessages.statusActive}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{categoryMessages.statusInactive}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground">
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(category)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="size-4" />
                          {categoryMessages.edit}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            if (
                              confirm(
                                formatMessage(categoryMessages.deleteConfirm, {
                                  name: category.name,
                                }),
                              )
                            ) {
                              remove.mutate(category.id)
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                          {categoryMessages.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {formatMessage(messages.settings.paginationShowing, {
            count: categories.length,
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
            {messages.settings.paginationPrevious}
          </Button>
          <span>{formatMessage(messages.settings.paginationPage, { page, pageCount })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + pageSize >= total}
            onClick={() => setOffset((prev) => prev + pageSize)}
          >
            {messages.settings.paginationNext}
          </Button>
        </div>
      </div>

      <ProductCategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} category={editing} />
    </div>
  )
}
