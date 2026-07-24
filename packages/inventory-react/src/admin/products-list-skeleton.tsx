"use client"

import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"

const SKELETON_ROWS = 6
const HEADER_WIDTHS = ["w-16", "w-14", "w-20", "w-8", "w-20"] as const
const COLUMN_WIDTHS = ["w-48", "w-16", "w-24", "w-8", "w-24"] as const

/**
 * Route-level placeholder for the products list page. Matches
 * `ProductsPage`'s header row, the search input, and the 5-column product
 * table exactly. Kept in its own lean module (ui skeleton + table + the
 * table only) so the extension factory can attach it as a `pendingComponent`
 * without pinning the products data layer into the workspace-chrome chunk.
 */
export function ProductsListSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header: title + description + "New product" button */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Search */}
      <Skeleton className="h-9 w-full max-w-sm" />

      {/* Table: Name | Status | Sell Amount | Pax | Start Date */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {HEADER_WIDTHS.map((width, column) => (
                <TableHead
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: inventory-react; existing suppression is intentional pending typed cleanup.
                  key={column}
                >
                  <Skeleton className={`h-3.5 ${width}`} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }).map((_, row) => (
              <TableRow
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: inventory-react; existing suppression is intentional pending typed cleanup.
                key={row}
              >
                {COLUMN_WIDTHS.map((width, column) => (
                  <TableCell
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: inventory-react; existing suppression is intentional pending typed cleanup.
                    key={column}
                  >
                    <Skeleton className={`h-4 ${width}`} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination bar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  )
}
