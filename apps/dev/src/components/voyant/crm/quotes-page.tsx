import { useNavigate } from "@tanstack/react-router"
import { type QuoteRecord, useQuotes } from "@voyantjs/crm-react"
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { Loader2, Plus } from "lucide-react"
import { useState } from "react"
import {
  formatDate,
  formatMoney,
  formatRelative,
  QUOTE_STATUS_OPTIONS,
} from "@/components/voyant/crm/crm-constants"
import { CreateQuoteDialog } from "./create-quote-dialog"

export function QuotesPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isPending, isError } = useQuotes({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
  })

  const quotes = data?.data ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
          <p className="text-sm text-muted-foreground">
            Quotes issued for opportunities in your pipeline.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 size-4" />
          New quote
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-[180px] text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {QUOTE_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Valid until</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-destructive">
                  Failed to load quotes.
                </TableCell>
              </TableRow>
            ) : quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  No quotes found.
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((q: QuoteRecord) => (
                <TableRow
                  key={q.id}
                  onClick={() => void navigate({ to: "/quotes/$id", params: { id: q.id } })}
                  className="cursor-pointer"
                >
                  <TableCell className="font-mono text-xs">{q.id.slice(-8)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatMoney(q.totalAmountCents, q.currency)}
                  </TableCell>
                  <TableCell>{formatDate(q.validUntil)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelative(q.updatedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateQuoteDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
