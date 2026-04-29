"use client"

import { usePublicBookingPayments } from "@voyantjs/finance-react"
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { CreditCard } from "lucide-react"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  completed: "default",
  failed: "destructive",
  refunded: "secondary",
}

import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider"

export interface BookingPaymentsSummaryProps {
  bookingId: string
}

export function BookingPaymentsSummary({ bookingId }: BookingPaymentsSummaryProps) {
  const { data } = usePublicBookingPayments(bookingId)
  const { formatDate, formatNumber } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

  const payments = data?.data?.payments ?? []

  return (
    <Card data-slot="booking-payments-summary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {messages.bookingPaymentsSummary.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.bookingPaymentsSummary.empty}
          </p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">
                    {messages.bookingPaymentsSummary.columns.invoice}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingPaymentsSummary.columns.method}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingPaymentsSummary.columns.status}
                  </th>
                  <th className="p-2 text-right font-medium">
                    {messages.bookingPaymentsSummary.columns.amount}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingPaymentsSummary.columns.date}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingPaymentsSummary.columns.reference}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-b-0">
                    <td className="p-2 font-mono text-xs">{payment.invoiceNumber}</td>
                    <td className="p-2">
                      {messages.bookingPaymentsSummary.paymentMethodLabels[
                        payment.paymentMethod as keyof typeof messages.bookingPaymentsSummary.paymentMethodLabels
                      ] ?? payment.paymentMethod}
                    </td>
                    <td className="p-2">
                      <Badge variant={statusVariant[payment.status] ?? "secondary"}>
                        {messages.bookingPaymentsSummary.paymentStatusLabels[
                          payment.status as keyof typeof messages.bookingPaymentsSummary.paymentStatusLabels
                        ] ?? payment.status}
                      </Badge>
                    </td>
                    <td className="p-2 text-right font-mono">
                      {`${formatNumber(payment.amountCents / 100, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} ${payment.currency}`}
                    </td>
                    <td className="p-2">{formatDate(payment.paymentDate)}</td>
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
