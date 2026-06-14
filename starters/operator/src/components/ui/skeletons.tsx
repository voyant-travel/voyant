/**
 * Skeleton atoms. The `<Skeleton />` primitive handles the pulse/animation;
 * these just wrap common shapes (a text line, a table-row stand-in).
 *
 * Do NOT add "page-shaped" helpers here — each page/section owns a skeleton
 * that mirrors its real markup exactly (same grid, same card count, same
 * column widths). A generic "SkeletonDetailPage" lies about what's loading.
 *
 * Rule of thumb:
 *  - Action waits inside a button → <Loader2 /> spinner
 *  - Page / list / section content → a purpose-built skeleton component
 *    that mirrors the real layout 1:1
 */

import { cn } from "@voyant-travel/ui/lib/utils"

import { Skeleton } from "./skeleton"
import { TableBody, TableCell, TableRow } from "./table"

/** Single text line. Pick a width class to vary. */
export function SkeletonLine({ className }: { className?: string }) {
  return <Skeleton className={cn("h-4 w-full", className)} />
}

/**
 * Placeholder `<TableBody>` with the given shape. Widths vary per column so
 * it doesn't read as a perfect grid.
 */
export function SkeletonTableRows({
  rows = 6,
  columns = 4,
  columnWidths,
}: {
  rows?: number
  columns?: number
  /** Optional Tailwind width classes per column; falls back to a sensible default. */
  columnWidths?: Array<string | undefined>
}) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: operator; existing suppression is intentional pending typed cleanup.
          key={r}
        >
          {Array.from({ length: columns }).map((__, c) => {
            const width =
              columnWidths?.[c] ??
              (c === 0 ? "w-2/3" : c === columns - 1 ? "w-16" : "w-1/2")
            return (
              <TableCell
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: operator; existing suppression is intentional pending typed cleanup.
                key={c}
              >
                <Skeleton className={cn("h-4", width)} />
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </TableBody>
  )
}
