import { useNavigate } from "@tanstack/react-router"
import { type QuoteRecord, useQuotes } from "@voyantjs/crm-react"
import { Loader2, Plus } from "lucide-react"
import { useState } from "react"

import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CreateQuoteDialog } from "./create-quote-dialog"
import { useRegistryCrmI18nOrDefault, useRegistryCrmMessagesOrDefault } from "./i18n"
import {
  formatRegistryCrmDate,
  formatRegistryCrmMoney,
  formatRegistryCrmRelative,
} from "./i18n/utils"

export function QuotesPage() {
  const navigate = useNavigate()
  const i18n = useRegistryCrmI18nOrDefault()
  const m = useRegistryCrmMessagesOrDefault()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isPending, isError } = useQuotes({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
  })

  const quotes = data?.data ?? []
  const quoteStatusOptions = [
    { value: "draft", label: m.common.quoteStatusLabels.draft },
    { value: "sent", label: m.common.quoteStatusLabels.sent },
    { value: "accepted", label: m.common.quoteStatusLabels.accepted },
    { value: "expired", label: m.common.quoteStatusLabels.expired },
    { value: "rejected", label: m.common.quoteStatusLabels.rejected },
    { value: "archived", label: m.common.quoteStatusLabels.archived },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{m.quotesPage.title}</h1>
          <p className="text-sm text-muted-foreground">{m.quotesPage.description}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 size-4" />
          {m.quotesPage.create}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-[180px] text-sm">
            <SelectValue placeholder={m.quotesPage.filters.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.quotesPage.filters.allStatuses}</SelectItem>
            {quoteStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m.quotesPage.columns.quote}</TableHead>
              <TableHead>{m.quotesPage.columns.status}</TableHead>
              <TableHead>{m.quotesPage.columns.total}</TableHead>
              <TableHead>{m.quotesPage.columns.validUntil}</TableHead>
              <TableHead>{m.quotesPage.columns.updated}</TableHead>
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
                  {m.quotesPage.loadFailed}
                </TableCell>
              </TableRow>
            ) : quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  {m.quotesPage.empty}
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((quote: QuoteRecord) => {
                const statusLabel =
                  m.common.quoteStatusLabels[
                    quote.status as keyof typeof m.common.quoteStatusLabels
                  ] ?? quote.status
                return (
                  <TableRow
                    key={quote.id}
                    onClick={() => void navigate({ to: "/quotes/$id", params: { id: quote.id } })}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-mono text-xs">{quote.id.slice(-8)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{statusLabel}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatRegistryCrmMoney(i18n, quote.totalAmountCents, quote.currency)}
                    </TableCell>
                    <TableCell>{formatRegistryCrmDate(i18n, quote.validUntil)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRegistryCrmRelative(i18n, quote.updatedAt)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateQuoteDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
