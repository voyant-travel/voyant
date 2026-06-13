"use client"

import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { TableBody, TableCell, TableRow } from "@voyantjs/ui/components/table"

/** Placeholder `<TableBody>` with one skeleton line per cell. */
export function SkeletonRows({ rows, widths }: { rows: number; widths: ReadonlyArray<string> }) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, row) => (
        <TableRow
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: relationships-react; existing suppression is intentional pending typed cleanup.
          key={row}
        >
          {widths.map((width, column) => (
            <TableCell
              // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: relationships-react; existing suppression is intentional pending typed cleanup.
              key={column}
            >
              <Skeleton className={`h-4 ${width}`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  )
}
