import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"

import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"

const PAYMENT_WIDTHS = ["w-20", "w-32", "w-32", "w-24", "w-20", "w-24", "w-24"]

export function PaymentsTableSkeleton({ rows = 8 }: { rows?: number }) {
  const messages = useFinanceUiMessagesOrDefault()
  const columns = messages.paymentsPage.columns

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{columns.kind}</TableHead>
            <TableHead>{columns.reference}</TableHead>
            <TableHead>{columns.party}</TableHead>
            <TableHead>{columns.amount}</TableHead>
            <TableHead>{columns.status}</TableHead>
            <TableHead>{columns.date}</TableHead>
            <TableHead>{columns.method}</TableHead>
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
    <div className="flex flex-col gap-6 p-6">
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
