"use client"

import { confirmDialog } from "@voyant-travel/ui/components"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voyant-travel/ui/components/dropdown-menu"
import { Input } from "@voyant-travel/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"
import { Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
import * as React from "react"
import type { PricingCategoryType } from "../i18n/messages.js"
import { usePricingUiMessagesOrDefault } from "../i18n/provider.js"
import {
  type PricingCategoryRecord,
  usePricingCategories,
  usePricingCategoryMutation,
} from "../index.js"
import { PricingCategoryDialog } from "./pricing-category-dialog.js"

export interface PricingCategoryListProps {
  pageSize?: number
}

export function PricingCategoryList({ pageSize = 25 }: PricingCategoryListProps = {}) {
  const messages = usePricingUiMessagesOrDefault()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PricingCategoryRecord | undefined>(undefined)
  const [search, setSearch] = React.useState("")
  const [offset, setOffset] = React.useState(0)

  const { data, isPending, isError } = usePricingCategories({
    limit: pageSize,
    offset,
    search: search || undefined,
    active: undefined,
  })
  const { remove } = usePricingCategoryMutation()

  const categories = data?.data ?? []
  const total = data?.total ?? 0
  const page = Math.floor(offset / pageSize) + 1
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div data-slot="pricing-category-list" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={messages.pricingCategoryList.searchPlaceholder}
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
          <Plus className="mr-2 size-4" />
          {messages.pricingCategoryList.add}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.pricingCategoryList.columns.name}</TableHead>
              <TableHead>{messages.pricingCategoryList.columns.code}</TableHead>
              <TableHead>{messages.pricingCategoryList.columns.type}</TableHead>
              <TableHead>{messages.pricingCategoryList.columns.age}</TableHead>
              <TableHead>{messages.pricingCategoryList.columns.seat}</TableHead>
              <TableHead>{messages.pricingCategoryList.columns.sort}</TableHead>
              <TableHead>{messages.pricingCategoryList.columns.status}</TableHead>
              <TableHead className="w-[80px] text-right">
                {messages.pricingCategoryList.columns.actions}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-sm text-destructive">
                  {messages.pricingCategoryList.loadingError}
                </TableCell>
              </TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                  {messages.pricingCategoryList.empty}
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {category.code ?? messages.common.none}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {
                        messages.common.categoryTypeLabels[
                          category.categoryType as PricingCategoryType
                        ]
                      }
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {category.isAgeQualified
                      ? `${category.minAge ?? 0}–${category.maxAge ?? "∞"}`
                      : messages.common.none}
                  </TableCell>
                  <TableCell className="font-mono">{category.seatOccupancy}</TableCell>
                  <TableCell className="font-mono">{category.sortOrder}</TableCell>
                  <TableCell>
                    <Badge variant={category.active ? "default" : "outline"}>
                      {category.active ? messages.common.active : messages.common.inactive}
                    </Badge>
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
                          {messages.pricingCategoryList.edit}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={async () => {
                            if (
                              await confirmDialog({
                                description: messages.pricingCategoryList.deleteConfirm.replace(
                                  "{name}",
                                  category.name,
                                ),
                                destructive: true,
                              })
                            ) {
                              remove.mutate(category.id)
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                          {messages.pricingCategoryList.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {messages.pricingCategoryList.showingSummary
            .replace("{count}", String(categories.length))
            .replace("{total}", String(total))}
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

      <PricingCategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} category={editing} />
    </div>
  )
}
