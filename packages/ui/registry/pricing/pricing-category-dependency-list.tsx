"use client"

import { useQueries } from "@tanstack/react-query"
import {
  getPricingCategoryQueryOptions,
  type PricingCategoryDependencyRecord,
  usePricingCategoryDependencies,
  usePricingCategoryDependencyMutation,
  useVoyantPricingContext,
} from "@voyantjs/pricing-react"
import { usePricingUiMessagesOrDefault } from "@voyantjs/pricing-ui"
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { useRegistryPricingMessagesOrDefault } from "./i18n"
import { PricingCategoryDependencyDialog } from "./pricing-category-dependency-dialog"

const LIMIT_SEPARATOR = " · " // i18n-literal-ok punctuation separator

export interface PricingCategoryDependencyListProps {
  pageSize?: number
}

export function PricingCategoryDependencyList({
  pageSize = 25,
}: PricingCategoryDependencyListProps = {}) {
  const sharedMessages = usePricingUiMessagesOrDefault()
  const registryMessages = useRegistryPricingMessagesOrDefault()
  const listMessages = registryMessages.pricingCategoryDependencyList
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PricingCategoryDependencyRecord | undefined>()
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
      if (query.data) {
        map.set(categoryIds[index], query.data)
      }
    })
    return map
  }, [categoryIds, categoryQueries])

  return (
    <div data-slot="pricing-category-dependency-list" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{listMessages.title}</h2>
          <p className="text-sm text-muted-foreground">{listMessages.description}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 size-4" />
          {listMessages.add}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{listMessages.columns.master}</TableHead>
              <TableHead>{listMessages.columns.dependent}</TableHead>
              <TableHead>{listMessages.columns.type}</TableHead>
              <TableHead>{listMessages.columns.limits}</TableHead>
              <TableHead>{listMessages.columns.status}</TableHead>
              <TableHead className="w-[80px] text-right">{listMessages.columns.actions}</TableHead>
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
                  {listMessages.states.loadFailed}
                </TableCell>
              </TableRow>
            ) : dependencies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  {listMessages.states.empty}
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
                      {sharedMessages.common.dependencyTypeLabels[dependency.dependencyType]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {dependency.maxPerMaster != null
                      ? `${listMessages.labels.perMaster}: ${dependency.maxPerMaster}`
                      : ""}
                    {dependency.maxPerMaster != null && dependency.maxDependentSum != null
                      ? LIMIT_SEPARATOR
                      : ""}
                    {dependency.maxDependentSum != null
                      ? `${listMessages.labels.sum}: ${dependency.maxDependentSum}`
                      : ""}
                    {dependency.maxPerMaster == null && dependency.maxDependentSum == null
                      ? listMessages.states.noLimit
                      : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={dependency.active ? "default" : "outline"}>
                      {dependency.active
                        ? sharedMessages.common.active
                        : sharedMessages.common.inactive}
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
                          {listMessages.labels.edit}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            if (confirm(listMessages.labels.deleteConfirm)) {
                              remove.mutate(dependency.id)
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                          {listMessages.labels.delete}
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
          {listMessages.labels.showing} {dependencies.length} {listMessages.labels.of} {total}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
          >
            {sharedMessages.common.previous}
          </Button>
          <span>
            {sharedMessages.common.page} {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + pageSize >= total}
            onClick={() => setOffset((prev) => prev + pageSize)}
          >
            {sharedMessages.common.next}
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
