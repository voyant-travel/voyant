import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"

const PAYMENT_WIDTHS = ["w-20", "w-32", "w-32", "w-24", "w-20", "w-24", "w-24"]
const PAYMENT_HEADER_WIDTHS = ["w-12", "w-20", "w-12", "w-16", "w-14", "w-12", "w-16"]

export function PaymentsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {PAYMENT_HEADER_WIDTHS.map((width, columnIndex) => (
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
              {Array.from({ length: 7 }).map((__, columnIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders -- owner: finance-react; existing suppression is intentional pending typed cleanup.
                <TableCell key={columnIndex}>
                  <Skeleton className={`h-4 ${PAYMENT_WIDTHS[columnIndex] ?? "w-1/2"}`} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function PaymentsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-44" />
      </div>

      <Skeleton className="h-9 w-full max-w-sm" />

      <PaymentsTableSkeleton rows={8} />
    </div>
  )
}
