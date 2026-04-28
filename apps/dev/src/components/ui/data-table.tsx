"use client"

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  type PaginationState,
  getSortedRowModel,
  type OnChangeFn,
  type Row,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import * as React from "react"

import { cn } from "@voyantjs/ui/lib/utils"

import { Checkbox } from "./checkbox"
import { DataTablePagination } from "./data-table-pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table"

type DataTableManualPagination = {
  pageIndex: number
  pageSize: number
  total: number
  onPageIndexChange: (pageIndex: number) => void
}

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onRowClick?: (row: Row<TData>) => void
  emptyMessage?: string
  pageSize?: number
  showPagination?: boolean
  className?: string
  enableRowSelection?: boolean
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  getRowId?: (originalRow: TData, index: number, parent?: Row<TData>) => string
  pagination?: DataTableManualPagination
  renderSelectionActions?: (context: {
    selectedRows: Row<TData>[]
    clearSelection: () => void
  }) => React.ReactNode
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No results.",
  pageSize = 10,
  showPagination = true,
  className,
  enableRowSelection = false,
  rowSelection,
  onRowSelectionChange,
  getRowId,
  pagination,
  renderSelectionActions,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({})
  const resolvedRowSelection = rowSelection ?? internalRowSelection
  const isManualPagination = pagination !== undefined
  const resolvedPageSize = pagination?.pageSize ?? pageSize
  const totalRows = pagination?.total ?? data.length
  const paginationState = React.useMemo<PaginationState>(
    () => ({
      pageIndex: pagination?.pageIndex ?? 0,
      pageSize: resolvedPageSize,
    }),
    [pagination?.pageIndex, resolvedPageSize],
  )

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = React.useCallback(
    (updater) => {
      if (onRowSelectionChange) {
        onRowSelectionChange(updater)
        return
      }

      setInternalRowSelection(updater)
    },
    [onRowSelectionChange],
  )

  const selectionColumn = React.useMemo<ColumnDef<TData, TValue>>(
    () => ({
      id: "__select__",
      header: ({ table }) => (
        <div
          className="flex items-center justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            aria-label="Select all rows on page"
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div
          className="flex items-center justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            aria-label="Select row"
            checked={row.getIsSelected()}
            indeterminate={row.getIsSomeSelected() && !row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked)}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    }),
    [],
  )

  const resolvedColumns = React.useMemo(
    () => (enableRowSelection ? [selectionColumn, ...columns] : columns),
    [columns, enableRowSelection, selectionColumn],
  )

  const table = useReactTable({
    data,
    columns: resolvedColumns,
    initialState: {
      pagination: {
        pageSize: resolvedPageSize,
      },
    },
    manualPagination: isManualPagination,
    pageCount: isManualPagination ? Math.max(1, Math.ceil(totalRows / resolvedPageSize)) : undefined,
    enableRowSelection,
    onSortingChange: setSorting,
    onRowSelectionChange: handleRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: isManualPagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
    state: {
      pagination: paginationState,
      rowSelection: resolvedRowSelection,
      sorting,
    },
  })

  const selectedRows = table.getSelectedRowModel().rows
  const clearSelection = React.useCallback(
    () => handleRowSelectionChange({}),
    [handleRowSelectionChange],
  )

  return (
    <div className="space-y-3">
      {enableRowSelection && selectedRows.length > 0 && renderSelectionActions
        ? renderSelectionActions({ selectedRows, clearSelection })
        : null}
      <div className={cn("overflow-hidden rounded-md border", className)}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  onClick={() => onRowClick?.(row)}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={resolvedColumns.length} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {showPagination &&
        (isManualPagination ? totalRows > resolvedPageSize : table.getPrePaginationRowModel().rows.length > resolvedPageSize) ? (
          <DataTablePagination
            table={table}
            totalRows={totalRows}
            onPageIndexChange={pagination?.onPageIndexChange}
          />
        ) : null}
      </div>
    </div>
  )
}
