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
import { cn } from "@voyantjs/ui/lib/utils"
import { Loader2, Plus } from "lucide-react"
import { useState } from "react"

import { useCrmUiI18nOrDefault } from "../i18n/index.js"
import type { CrmQuoteStatus } from "../i18n/messages.js"
import { CreateQuoteDialog } from "./create-quote-dialog.js"
import { formatCrmDate, formatCrmMoney, formatCrmRelative } from "./crm-format.js"

export interface QuotesPageProps {
  onQuoteOpen?: (quote: QuoteRecord) => void
  onQuoteCreated?: (quote: QuoteRecord) => void
  className?: string
}

export function QuotesPage({ onQuoteOpen, onQuoteCreated, className }: QuotesPageProps = {}) {
  const i18n = useCrmUiI18nOrDefault()
  const { messages } = i18n
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isPending, isError } = useQuotes({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
  })

  const quotes = data?.data ?? []
  const quoteStatusOptions = Object.entries(messages.common.quoteStatusLabels).map(
    ([value, label]) => ({ value, label }),
  )

  const handleCreated = (quote: QuoteRecord) => {
    onQuoteCreated?.(quote)
    onQuoteOpen?.(quote)
  }

  return (
    <div data-slot="quotes-page" className={cn("flex flex-col gap-6 p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{messages.quotesPage.title}</h1>
          <p className="text-sm text-muted-foreground">{messages.quotesPage.description}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 size-4" aria-hidden="true" />
          {messages.quotesPage.create}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
          <SelectTrigger className="w-[180px] text-sm">
            <SelectValue placeholder={messages.quotesPage.filters.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{messages.quotesPage.filters.allStatuses}</SelectItem>
            {quoteStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.quotesPage.columns.quote}</TableHead>
              <TableHead>{messages.quotesPage.columns.status}</TableHead>
              <TableHead>{messages.quotesPage.columns.total}</TableHead>
              <TableHead>{messages.quotesPage.columns.validUntil}</TableHead>
              <TableHead>{messages.quotesPage.columns.updated}</TableHead>
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
                  {messages.quotesPage.loadFailed}
                </TableCell>
              </TableRow>
            ) : quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  {messages.quotesPage.empty}
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((quote) => {
                const statusLabel =
                  messages.common.quoteStatusLabels[quote.status as CrmQuoteStatus] ?? quote.status
                return (
                  <TableRow
                    key={quote.id}
                    onClick={() => onQuoteOpen?.(quote)}
                    className={cn(onQuoteOpen && "cursor-pointer")}
                  >
                    <TableCell className="font-mono text-xs">{quote.id.slice(-8)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{statusLabel}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCrmMoney(i18n, quote.totalAmountCents, quote.currency)}
                    </TableCell>
                    <TableCell>{formatCrmDate(i18n, quote.validUntil)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCrmRelative(i18n, quote.updatedAt)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateQuoteDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={handleCreated} />
    </div>
  )
}
