"use client"

import type { Table } from "@tanstack/react-table"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@voyant-travel/ui/components/button"

type DataTablePaginationProps<TData> = {
  table: Table<TData>
  totalRows: number
  onPageIndexChange?: (pageIndex: number) => void
}

export function DataTablePagination<TData>({
  table,
  totalRows,
  onPageIndexChange,
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const canPreviousPage = pageIndex > 0
  const canNextPage = pageIndex + 1 < pageCount
  const start = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const end = totalRows === 0 ? 0 : Math.min((pageIndex + 1) * pageSize, totalRows)

  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Showing {start}-{end} of {totalRows}
      </p>
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Page {totalRows === 0 ? 0 : pageIndex + 1} of {pageCount}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onPageIndexChange ? onPageIndexChange(pageIndex - 1) : table.previousPage()
          }
          disabled={!canPreviousPage}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (onPageIndexChange ? onPageIndexChange(pageIndex + 1) : table.nextPage())}
          disabled={!canNextPage}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
