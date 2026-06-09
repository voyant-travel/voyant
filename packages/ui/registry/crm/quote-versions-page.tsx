import { useNavigate } from "@tanstack/react-router"
import { type QuoteVersionRecord, useQuoteVersions } from "@voyantjs/crm-react"
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

import { CreateQuoteVersionDialog } from "./create-quote-version-dialog"
import { useRegistryCrmI18nOrDefault, useRegistryCrmMessagesOrDefault } from "./i18n"
import {
  formatRegistryCrmDate,
  formatRegistryCrmMoney,
  formatRegistryCrmRelative,
} from "./i18n/utils"

export function QuoteVersionsPage() {
  const navigate = useNavigate()
  const i18n = useRegistryCrmI18nOrDefault()
  const m = useRegistryCrmMessagesOrDefault()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isPending, isError } = useQuoteVersions({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
  })

  const quoteVersions = data?.data ?? []
  const quoteVersionStatusOptions = [
    { value: "draft", label: m.common.quoteVersionStatusLabels.draft },
    { value: "sent", label: m.common.quoteVersionStatusLabels.sent },
    { value: "accepted", label: m.common.quoteVersionStatusLabels.accepted },
    { value: "declined", label: m.common.quoteVersionStatusLabels.declined },
    { value: "superseded", label: m.common.quoteVersionStatusLabels.superseded },
    { value: "expired", label: m.common.quoteVersionStatusLabels.expired },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{m.quoteVersionsPage.title}</h1>
          <p className="text-sm text-muted-foreground">{m.quoteVersionsPage.description}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 size-4" />
          {m.quoteVersionsPage.create}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-[180px] text-sm">
            <SelectValue placeholder={m.quoteVersionsPage.filters.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.quoteVersionsPage.filters.allStatuses}</SelectItem>
            {quoteVersionStatusOptions.map((option) => (
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
              <TableHead>{m.quoteVersionsPage.columns.quoteVersion}</TableHead>
              <TableHead>{m.quoteVersionsPage.columns.status}</TableHead>
              <TableHead>{m.quoteVersionsPage.columns.total}</TableHead>
              <TableHead>{m.quoteVersionsPage.columns.validUntil}</TableHead>
              <TableHead>{m.quoteVersionsPage.columns.updated}</TableHead>
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
                  {m.quoteVersionsPage.loadFailed}
                </TableCell>
              </TableRow>
            ) : quoteVersions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  {m.quoteVersionsPage.empty}
                </TableCell>
              </TableRow>
            ) : (
              quoteVersions.map((quoteVersion: QuoteVersionRecord) => {
                const statusLabel =
                  m.common.quoteVersionStatusLabels[
                    quoteVersion.status as keyof typeof m.common.quoteVersionStatusLabels
                  ] ?? quoteVersion.status
                return (
                  <TableRow
                    key={quoteVersion.id}
                    onClick={() =>
                      void navigate({
                        to: "/quote-versions/$id",
                        params: { id: quoteVersion.id },
                      })
                    }
                    className="cursor-pointer"
                  >
                    <TableCell className="font-mono text-xs">
                      {quoteVersion.label ?? quoteVersion.id.slice(-8)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{statusLabel}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatRegistryCrmMoney(
                        i18n,
                        quoteVersion.totalAmountCents,
                        quoteVersion.currency,
                      )}
                    </TableCell>
                    <TableCell>{formatRegistryCrmDate(i18n, quoteVersion.validUntil)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRegistryCrmRelative(i18n, quoteVersion.updatedAt)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateQuoteVersionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
