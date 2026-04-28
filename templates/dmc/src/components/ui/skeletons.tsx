import { cn } from "@voyantjs/ui/lib/utils"

import { Skeleton } from "./skeleton"
import { TableBody, TableCell, TableRow } from "./table"

export function SkeletonLine({ className }: { className?: string }) {
  return <Skeleton className={cn("h-4 w-full", className)} />
}

export function SkeletonTableRows({
  rows = 6,
  columns = 4,
  columnWidths,
}: {
  rows?: number
  columns?: number
  columnWidths?: Array<string | undefined>
}) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders
          key={r}
        >
          {Array.from({ length: columns }).map((__, c) => {
            const width =
              columnWidths?.[c] ??
              (c === 0 ? "w-2/3" : c === columns - 1 ? "w-16" : "w-1/2")

            return (
              <TableCell
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders
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
