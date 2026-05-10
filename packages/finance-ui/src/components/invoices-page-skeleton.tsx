import { Skeleton } from "@voyantjs/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"

import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"

const INVOICE_WIDTHS = ["w-28", "w-16", "w-20", "w-20", "w-20", "w-24"]

export function InvoicesTableSkeleton({ rows = 8 }: { rows?: number }) {
  const messages = useFinanceUiMessagesOrDefault()
  const columns = messages.invoicesPage.columns

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{columns.invoiceNumber}</TableHead>
            <TableHead>{columns.status}</TableHead>
            <TableHead>{columns.total}</TableHead>
            <TableHead>{columns.paid}</TableHead>
            <TableHead>{columns.balanceDue}</TableHead>
            <TableHead>{columns.dueDate}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders
            <TableRow key={rowIndex}>
              {Array.from({ length: 6 }).map((__, columnIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders
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
    <div className="flex flex-col gap-6 p-6">
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
