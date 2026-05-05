"use client"

import { Link } from "@tanstack/react-router"
import { useInvoices } from "@voyantjs/finance-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { ExternalLink, FileText } from "lucide-react"

/**
 * Map invoice status to a badge variant — paid/sent are positive,
 * draft is neutral, void/refunded are destructive.
 */
const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  partially_paid: "secondary",
  overdue: "destructive",
  refunded: "destructive",
  void: "destructive",
}

/**
 * Map invoice type to a friendly label. The schema uses canonical
 * snake_case (`credit_note`); the UI shows them title-cased.
 */
const typeLabels: Record<string, string> = {
  invoice: "Invoice",
  proforma: "Proforma",
  credit_note: "Credit note",
}

export interface BookingInvoicesCardProps {
  bookingId: string
}

/**
 * Lists all invoices issued for a booking — proformas, final
 * invoices, credit notes — with their financial state (total / paid
 * / balance) and status. Distinct from the **payments** card which
 * shows the money received against those invoices.
 *
 * Hidden when the booking has no invoices yet (the "issue invoice"
 * action lives on the parent finance tab; we don't duplicate it
 * here when there's nothing to list).
 */
export function BookingInvoicesCard({
  bookingId,
}: BookingInvoicesCardProps): React.ReactElement | null {
  const { data, isLoading } = useInvoices({ bookingId, limit: 50 })
  const invoices = data?.data ?? []

  if (isLoading || invoices.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Facturi
          <Badge variant="outline" className="text-[10px]">
            {invoices.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Numar</th>
                <th className="px-4 py-2 text-left font-medium">Tip</th>
                <th className="px-4 py-2 text-left font-medium">Emisa</th>
                <th className="px-4 py-2 text-left font-medium">Scadenta</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Achitat</th>
                <th className="px-4 py-2 text-right font-medium">Sold</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
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
                      {formatDate(invoice.issueDate)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {formatMoney(invoice.totalCents, invoice.currency)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-600 dark:text-emerald-300">
                      {invoice.paidCents > 0
                        ? formatMoney(invoice.paidCents, invoice.currency)
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {invoice.balanceDueCents > 0 ? (
                        <span className="text-amber-600">
                          {formatMoney(invoice.balanceDueCents, invoice.currency)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={statusVariant[invoice.status] ?? "outline"}>
                        {invoice.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        to="/finance/invoices/$id"
                        params={{ id: invoice.id }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Open invoice"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function formatDate(iso: string): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return iso
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}
