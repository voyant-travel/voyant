"use client"

import { usePublicBookingPayments } from "@voyantjs/finance-react"
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/voyant-ui/components"
import { CreditCard } from "lucide-react"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  completed: "default",
  failed: "destructive",
  refunded: "secondary",
}

function formatAmount(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`
}

export interface BookingPaymentsSummaryProps {
  bookingId: string
}

export function BookingPaymentsSummary({ bookingId }: BookingPaymentsSummaryProps) {
  const { data } = usePublicBookingPayments(bookingId)

  const payments = data?.data?.payments ?? []

  return (
    <Card data-slot="booking-payments-summary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Payments
        </CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No payments recorded.</p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">Invoice</th>
                  <th className="p-2 text-left font-medium">Method</th>
                  <th className="p-2 text-left font-medium">Status</th>
                  <th className="p-2 text-right font-medium">Amount</th>
                  <th className="p-2 text-left font-medium">Date</th>
                  <th className="p-2 text-left font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-b-0">
                    <td className="p-2 font-mono text-xs">{payment.invoiceNumber}</td>
                    <td className="p-2 capitalize">{payment.paymentMethod.replace(/_/g, " ")}</td>
                    <td className="p-2">
                      <Badge
                        variant={statusVariant[payment.status] ?? "secondary"}
                        className="capitalize"
                      >
                        {payment.status}
                      </Badge>
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatAmount(payment.amountCents, payment.currency)}
                    </td>
                    <td className="p-2">{new Date(payment.paymentDate).toLocaleDateString()}</td>
                    <td className="max-w-[150px] truncate p-2 font-mono text-xs">
                      {payment.referenceNumber ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
