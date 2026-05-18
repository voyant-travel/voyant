"use client"

import { Link } from "@tanstack/react-router"
import { useLocale } from "@voyantjs/admin"
import { useInvoiceMutation, useInvoices } from "@voyantjs/finance-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { ArrowRightLeft, ExternalLink, FileText, Loader2 } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  partially_paid: "secondary",
  overdue: "destructive",
  refunded: "destructive",
  void: "destructive",
}

export interface BookingInvoicesCardProps {
  bookingId: string
}

export function BookingInvoicesCard({ bookingId }: BookingInvoicesCardProps): React.ReactElement {
  const messages = useAdminMessages().finance
  const { resolvedLocale } = useLocale()
  const { data, isLoading } = useInvoices({ bookingId, limit: 50 })
  const { convertToInvoice } = useInvoiceMutation()
  const invoices = data?.data ?? []
  // A proforma is "convertible" if it's still active (not void) AND no
  // sibling invoice already references it via convertedFromInvoiceId.
  const convertedProformaIds = new Set(
    invoices
      .map((inv) => (inv as { convertedFromInvoiceId?: string | null }).convertedFromInvoiceId)
      .filter((id): id is string => Boolean(id)),
  )

  const typeLabels: Record<string, string> = {
    invoice: messages.invoiceTypeInvoice,
    proforma: messages.invoiceTypeProforma,
    credit_note: messages.invoiceTypeCreditNote,
  }
  const statusLabels: Record<string, string> = {
    draft: messages.invoiceStatusDraft,
    sent: messages.invoiceStatusSent,
    partially_paid: messages.invoiceStatusPartiallyPaid,
    paid: messages.invoiceStatusPaid,
    overdue: messages.invoiceStatusOverdue,
    void: messages.invoiceStatusVoid,
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {messages.invoicesPageTitle}
          {invoices.length > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              {invoices.length}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-hidden p-0">
        {isLoading ? (
          <p className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </p>
        ) : invoices.length === 0 ? (
          <p className="px-6 py-6 text-center text-muted-foreground text-sm">
            {messages.bookingInvoicesEmpty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">
                    {messages.invoiceNumberColumn}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">{messages.invoiceTypeColumn}</th>
                  <th className="px-4 py-2 text-left font-medium">{messages.issueDateColumn}</th>
                  <th className="px-4 py-2 text-left font-medium">{messages.dueDateColumn}</th>
                  <th className="px-4 py-2 text-right font-medium">{messages.totalColumn}</th>
                  <th className="px-4 py-2 text-right font-medium">{messages.paidColumn}</th>
                  <th className="px-4 py-2 text-right font-medium">{messages.balanceDueColumn}</th>
                  <th className="px-4 py-2 text-left font-medium">{messages.statusColumn}</th>
                  <th className="w-8 px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const invoiceType = (invoice as { invoiceType?: string }).invoiceType ?? "invoice"
                  return (
                    <tr key={invoice.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2 font-mono text-xs">{invoice.invoiceNumber}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {typeLabels[invoiceType] ?? invoiceType}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {formatDate(invoice.issueDate, resolvedLocale)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {formatDate(invoice.dueDate, resolvedLocale)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {formatMoney(invoice.totalCents, invoice.currency, resolvedLocale)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-emerald-600 dark:text-emerald-300">
                        {invoice.paidCents > 0
                          ? formatMoney(invoice.paidCents, invoice.currency, resolvedLocale)
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {invoice.balanceDueCents > 0 ? (
                          <span className="text-amber-600">
                            {formatMoney(invoice.balanceDueCents, invoice.currency, resolvedLocale)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={statusVariant[invoice.status] ?? "outline"}>
                          {statusLabels[invoice.status] ?? invoice.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {invoiceType === "proforma" &&
                          invoice.status !== "void" &&
                          !convertedProformaIds.has(invoice.id) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={convertToInvoice.isPending}
                              onClick={() => {
                                if (!confirm(messages.convertConfirm)) return
                                convertToInvoice.mutate({ id: invoice.id })
                              }}
                              title={messages.convertToInvoice}
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                              <span className="ml-1">{messages.convertToInvoice}</span>
                            </Button>
                          ) : null}
                          <Link
                            to="/finance/invoices/$id"
                            params={{ id: invoice.id }}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={messages.openInvoice}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatMoney(cents: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function formatDate(iso: string, locale: string): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return iso
    return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}
