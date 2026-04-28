"use client"

import { useQueries } from "@tanstack/react-query"
import {
  getPricingCategoryQueryOptions,
  type PricingCategoryDependencyRecord,
  usePricingCategoryDependencies,
  usePricingCategoryDependencyMutation,
  useVoyantPricingContext,
} from "@voyantjs/pricing-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voyantjs/ui/components/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { PricingCategoryDependencyDialog } from "./pricing-category-dependency-dialog"

export interface PricingCategoryDependencyListProps {
  pageSize?: number
}

export function PricingCategoryDependencyList({
  pageSize = 25,
}: PricingCategoryDependencyListProps = {}) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PricingCategoryDependencyRecord | undefined>(
    undefined,
  )
  const [offset, setOffset] = React.useState(0)
  const { data, isPending, isError } = usePricingCategoryDependencies({
    limit: pageSize,
    offset,
  })
  const { remove } = usePricingCategoryDependencyMutation()
  const { baseUrl, fetcher } = useVoyantPricingContext()

  const dependencies = data?.data ?? []
  const total = data?.total ?? 0
  const page = Math.floor(offset / pageSize) + 1
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const categoryIds = React.useMemo(
    () =>
      Array.from(
        new Set(
          dependencies.flatMap((dependency) => [
            dependency.masterPricingCategoryId,
            dependency.pricingCategoryId,
          ]),
        ),
      ),
    [dependencies],
  )
  const categoryQueries = useQueries({
    queries: categoryIds.map((id) => getPricingCategoryQueryOptions({ baseUrl, fetcher }, id)),
  })
  const categoryById = React.useMemo(() => {
    const map = new Map<string, { name: string }>()
    categoryQueries.forEach((query, index) => {
      if (query.data) map.set(categoryIds[index], query.data)
    })
    return map
  }, [categoryIds, categoryQueries])

  return (
    <div data-slot="pricing-category-dependency-list" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Category Dependencies</h2>
          <p className="text-sm text-muted-foreground">
            Rules between pricing categories: requires, limits per master, excludes.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 size-4" />
          New dependency
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Master</TableHead>
              <TableHead>Dependent</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Limits</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-destructive">
                  Failed to load pricing category dependencies.
                </TableCell>
              </TableRow>
            ) : dependencies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  No category dependencies found.
                </TableCell>
              </TableRow>
            ) : (
              dependencies.map((dependency) => (
                <TableRow key={dependency.id}>
                  <TableCell className="text-muted-foreground">
                    {categoryById.get(dependency.masterPricingCategoryId)?.name ??
                      dependency.masterPricingCategoryId}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {categoryById.get(dependency.pricingCategoryId)?.name ??
                      dependency.pricingCategoryId}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {dependency.dependencyType.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {dependency.maxPerMaster != null
                      ? `per master: ${dependency.maxPerMaster}`
                      : ""}
                    {dependency.maxPerMaster != null && dependency.maxDependentSum != null
                      ? " · "
                      : ""}
                    {dependency.maxDependentSum != null ? `sum: ${dependency.maxDependentSum}` : ""}
                    {dependency.maxPerMaster == null && dependency.maxDependentSum == null
                      ? "—"
                      : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={dependency.active ? "default" : "outline"}>
                      {dependency.active ? "Active" : "Inactive"}
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
                            setEditing(dependency)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            if (confirm("Delete dependency?")) {
                              remove.mutate(dependency.id)
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                          Delete
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
          Showing {dependencies.length} of {total}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
          >
            Previous
          </Button>
          <span>
            Page {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + pageSize >= total}
            onClick={() => setOffset((prev) => prev + pageSize)}
          >
            Next
          </Button>
        </div>
      </div>

      <PricingCategoryDependencyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dependency={editing}
      />
    </div>
  )
}
