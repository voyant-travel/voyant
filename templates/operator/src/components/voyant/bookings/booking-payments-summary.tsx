"use client"

import { useLocale } from "@voyantjs/admin"
import { usePublicBookingPayments } from "@voyantjs/finance-react"
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { CreditCard } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  completed: "default",
  failed: "destructive",
  refunded: "secondary",
}

function getPaymentMethodLabel(
  method: string,
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["payments"],
) {
  switch (method) {
    case "bank_transfer":
      return messages.methodBankTransfer
    case "credit_card":
      return messages.methodCreditCard
    case "cash":
      return messages.methodCash
    case "cheque":
      return messages.methodCheque
    case "other":
      return messages.methodOther
    default:
      return method.replace(/_/g, " ")
  }
}

function getPaymentStatusLabel(
  status: string,
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["payments"],
) {
  switch (status) {
    case "pending":
      return messages.statusPending
    case "completed":
      return messages.statusCompleted
    case "failed":
      return messages.statusFailed
    case "refunded":
      return messages.statusRefunded
    default:
      return status
  }
}

export interface BookingPaymentsSummaryProps {
  bookingId: string
}

export function BookingPaymentsSummary({ bookingId }: BookingPaymentsSummaryProps) {
  const bookingDetailMessages = useAdminMessages().bookings.detail
  const paymentMessages = bookingDetailMessages.payments
  const { resolvedLocale } = useLocale()
  const { data } = usePublicBookingPayments(bookingId)

  const payments = data?.data?.payments ?? []

  const formatAmount = (cents: number, currency: string): string => {
    try {
      return new Intl.NumberFormat(resolvedLocale, {
        style: "currency",
        currency,
      }).format(cents / 100)
    } catch {
      return `${(cents / 100).toFixed(2)} ${currency}`
    }
  }

  return (
    <Card data-slot="booking-payments-summary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {paymentMessages.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{paymentMessages.empty}</p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">{paymentMessages.tableInvoice}</th>
                  <th className="p-2 text-left font-medium">{paymentMessages.tableMethod}</th>
                  <th className="p-2 text-left font-medium">{paymentMessages.tableStatus}</th>
                  <th className="p-2 text-right font-medium">{paymentMessages.tableAmount}</th>
                  <th className="p-2 text-left font-medium">{paymentMessages.tableDate}</th>
                  <th className="p-2 text-left font-medium">{paymentMessages.tableReference}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-b-0">
                    <td className="p-2 font-mono text-xs">{payment.invoiceNumber}</td>
                    <td className="p-2">
                      {getPaymentMethodLabel(payment.paymentMethod, paymentMessages)}
                    </td>
                    <td className="p-2">
                      <Badge variant={statusVariant[payment.status] ?? "secondary"}>
                        {getPaymentStatusLabel(payment.status, paymentMessages)}
                      </Badge>
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatAmount(payment.amountCents, payment.currency)}
                    </td>
                    <td className="p-2">
                      {new Date(payment.paymentDate).toLocaleDateString(resolvedLocale)}
                    </td>
                    <td className="max-w-[150px] truncate p-2 font-mono text-xs">
                      {payment.referenceNumber ?? bookingDetailMessages.noValue}
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
