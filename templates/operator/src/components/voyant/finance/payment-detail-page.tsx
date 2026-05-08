import { Link, useNavigate } from "@tanstack/react-router"
import { usePayment } from "@voyantjs/finance-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { type AdminMessages, useAdminMessages } from "@/lib/admin-i18n"
import { formatAmount, paymentStatusVariant } from "./finance-shared"
import { PaymentDetailSkeleton } from "./payment-detail-skeleton"

function getStatusLabel(messages: AdminMessages, status: string) {
  switch (status) {
    case "pending":
      return messages.finance.paymentStatusPending
    case "completed":
      return messages.finance.paymentStatusCompleted
    case "failed":
      return messages.finance.paymentStatusFailed
    case "refunded":
      return messages.finance.paymentStatusRefunded
    default:
      return status.replace(/_/g, " ")
  }
}

function getMethodLabel(messages: AdminMessages, method: string) {
  switch (method) {
    case "bank_transfer":
      return messages.finance.paymentMethodBankTransfer
    case "credit_card":
      return messages.finance.paymentMethodCreditCard
    case "debit_card":
      return messages.finance.paymentMethodDebitCard
    case "cash":
      return messages.finance.paymentMethodCash
    case "cheque":
      return messages.finance.paymentMethodCheque
    case "wallet":
      return messages.finance.paymentMethodWallet
    case "direct_bill":
      return messages.finance.paymentMethodDirectBill
    case "voucher":
      return messages.finance.paymentMethodVoucher
    case "other":
      return messages.finance.paymentMethodOther
    default:
      return method.replace(/_/g, " ")
  }
}

function getKindLabel(messages: AdminMessages, kind: "customer" | "supplier") {
  return kind === "customer" ? messages.finance.kindCustomer : messages.finance.kindSupplier
}

export function PaymentDetailPage({ id }: { id: string }) {
  const messages = useAdminMessages()
  const navigate = useNavigate()
  const { data, isPending, isError } = usePayment(id)
  const f = messages.finance
  const detail = f.paymentDetail
  const noValue = f.detailSections.noValue

  if (isPending) {
    return <PaymentDetailSkeleton />
  }

  if (isError || !data?.data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{isError ? detail.loadFailed : detail.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/finance/payments" })}>
          {detail.backToPayments}
        </Button>
      </div>
    )
  }

  const payment = data.data

  // Subtitle surfaces the related document (invoice / booking number) so an
  // operator can recognise *what* this payment is for, but the page itself
  // is identified by the payment id — that's the record on screen.
  const relatedNumber = payment.kind === "customer" ? payment.invoiceNumber : payment.bookingNumber

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void navigate({ to: "/finance/payments" })}
          aria-label={detail.backToPayments}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-mono text-lg font-semibold tracking-tight">
              {payment.id}
            </h1>
            <Badge variant="outline" className="capitalize">
              {getKindLabel(messages, payment.kind)}
            </Badge>
          </div>
          {relatedNumber ? (
            <p className="mt-1 text-sm text-muted-foreground">{relatedNumber}</p>
          ) : null}
        </div>
        <Badge variant={paymentStatusVariant[payment.status] ?? "secondary"} className="capitalize">
          {getStatusLabel(messages, payment.status)}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{detail.summaryTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              <Row label={detail.amountLabel}>
                <span className="font-mono">
                  {formatAmount(payment.amountCents, payment.currency)}
                </span>
              </Row>
              {payment.baseAmountCents !== null && payment.baseCurrency ? (
                <Row label={detail.baseAmountLabel}>
                  <span className="font-mono">
                    {formatAmount(payment.baseAmountCents, payment.baseCurrency)}
                  </span>
                </Row>
              ) : null}
              <Row label={detail.statusLabel}>
                <Badge
                  variant={paymentStatusVariant[payment.status] ?? "secondary"}
                  className="capitalize"
                >
                  {getStatusLabel(messages, payment.status)}
                </Badge>
              </Row>
              <Row label={detail.methodLabel}>
                <span className="capitalize">
                  {getMethodLabel(messages, payment.paymentMethod)}
                </span>
              </Row>
              <Row label={detail.dateLabel}>{payment.paymentDate}</Row>
              <Row label={detail.referenceLabel}>{payment.referenceNumber ?? noValue}</Row>
              {payment.notes ? (
                <div className="mt-2 flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {detail.notesLabel}
                  </dt>
                  <dd className="whitespace-pre-wrap text-sm">{payment.notes}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{detail.linksTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              {payment.kind === "customer" ? (
                <>
                  <Row label={detail.paidByLabel}>
                    {payment.personId && payment.personName ? (
                      <Link
                        to="/people/$id"
                        params={{ id: payment.personId }}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {payment.personName}
                        <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    ) : payment.organizationId && payment.organizationName ? (
                      <Link
                        to="/organizations/$id"
                        params={{ id: payment.organizationId }}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {payment.organizationName}
                        <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    ) : (
                      noValue
                    )}
                  </Row>
                  {payment.personId &&
                  payment.personName &&
                  payment.organizationId &&
                  payment.organizationName ? (
                    <Row label={detail.organizationLabel}>
                      <Link
                        to="/organizations/$id"
                        params={{ id: payment.organizationId }}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {payment.organizationName}
                        <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    </Row>
                  ) : null}
                  <Row label={detail.invoiceLabel}>
                    {payment.invoiceId ? (
                      <Link
                        to="/finance/invoices/$id"
                        params={{ id: payment.invoiceId }}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {payment.invoiceNumber ?? detail.viewInvoice}
                        <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    ) : (
                      noValue
                    )}
                  </Row>
                </>
              ) : (
                <>
                  <Row label={detail.paidToLabel}>
                    {payment.supplierId && payment.supplierName ? (
                      <Link
                        to="/suppliers/$id"
                        params={{ id: payment.supplierId }}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {payment.supplierName}
                        <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    ) : (
                      (payment.supplierName ?? noValue)
                    )}
                  </Row>
                  <Row label={detail.bookingLabel}>
                    {payment.bookingId ? (
                      <Link
                        to="/bookings/$id"
                        params={{ id: payment.bookingId }}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {payment.bookingNumber ?? detail.viewBooking}
                        <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    ) : (
                      noValue
                    )}
                  </Row>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{detail.metadataTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm">
            <Row label={detail.kindLabel}>
              <span className="capitalize">{getKindLabel(messages, payment.kind)}</span>
            </Row>
            <Row label={detail.createdLabel}>{new Date(payment.createdAt).toLocaleString()}</Row>
            <Row label={detail.updatedLabel}>{new Date(payment.updatedAt).toLocaleString()}</Row>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}
