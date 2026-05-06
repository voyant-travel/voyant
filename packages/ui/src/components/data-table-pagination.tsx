"use client"

import type { Table } from "@tanstack/react-table"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "./button.js"

type DataTablePaginationProps<TData> = {
  table: Table<TData>
}

export function DataTablePagination<TData>({ table }: DataTablePaginationProps<TData>) {
  const totalRows = table.getPrePaginationRowModel().rows.length
  const { pageIndex, pageSize } = table.getState().pagination
  const start = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const end = totalRows === 0 ? 0 : Math.min((pageIndex + 1) * pageSize, totalRows)

  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Showing {start}-{end} of {totalRows}
      </p>
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Page {totalRows === 0 ? 0 : pageIndex + 1} of {table.getPageCount()}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
