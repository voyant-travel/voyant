import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"

const INVOICE_WIDTHS = ["w-28", "w-16", "w-20", "w-20", "w-20", "w-24"]
const INVOICE_HEADER_WIDTHS = ["w-24", "w-14", "w-12", "w-10", "w-20", "w-16"]

export function InvoicesTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {INVOICE_HEADER_WIDTHS.map((width, columnIndex) => (
              <TableHead
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: finance-react; existing suppression is intentional pending typed cleanup.
                key={columnIndex}
              >
                <Skeleton className={`h-3.5 ${width}`} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: finance-react; existing suppression is intentional pending typed cleanup.
            <TableRow key={rowIndex}>
              {Array.from({ length: 6 }).map((__, columnIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: finance-react; existing suppression is intentional pending typed cleanup.
                <TableCell key={columnIndex}>
                  <Skeleton className={`h-4 ${INVOICE_WIDTHS[columnIndex] ?? "w-1/2"}`} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function InvoicesPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <Skeleton className="h-9 w-full max-w-sm" />

      <InvoicesTableSkeleton rows={8} />
    </div>
  )
}
