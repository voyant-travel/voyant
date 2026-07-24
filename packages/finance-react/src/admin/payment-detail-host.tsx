"use client"

import {
  type AdminDestinationKey,
  type AdminDestinations,
  type OperatorAdminMessages,
  useAdminHref,
  useAdminNavigate,
  useLocale,
  useOperatorAdminMessages,
} from "@voyant-travel/admin"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components"
import { ArrowLeft, ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import { usePayment } from "../index.js"

import { formatAmount, paymentStatusVariant } from "./finance-shared.js"
import { PaymentDetailSkeleton } from "./payment-detail-skeleton.js"

function getStatusLabel(messages: OperatorAdminMessages, status: string) {
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

function getMethodLabel(messages: OperatorAdminMessages, method: string) {
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
    case "travel_credit":
      return messages.finance.paymentMethodTravelCredit
    case "other":
      return messages.finance.paymentMethodOther
    default:
      return method.replace(/_/g, " ")
  }
}

function getKindLabel(messages: OperatorAdminMessages, kind: "customer" | "supplier") {
  return kind === "customer" ? messages.finance.kindCustomer : messages.finance.kindSupplier
}

/**
 * Anchor that resolves a semantic destination (RFC §4.7) to an href and
 * commits navigation through the host-injected router — keeps the page free
 * of any host route-tree import while still rendering a real link.
 */
function DestinationLink<K extends AdminDestinationKey>({
  destination,
  params,
  children,
}: {
  destination: K
  params: AdminDestinations[K]
  children: ReactNode
}) {
  const resolveHref = useAdminHref()
  const navigateTo = useAdminNavigate()

  return (
    <a
      href={resolveHref(destination, params)}
      onClick={(event) => {
        event.preventDefault()
        navigateTo(destination, params)
      }}
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  )
}

export interface PaymentDetailHostProps {
  id: string
}

/**
 * Packaged admin host for the payment detail page (packaged-admin RFC
 * Phase 3). Data access goes through `@voyant-travel/finance-react`; every
 * cross-route link (`payment.list` back target, person/organization/
 * invoice/supplier/booking links) resolves through semantic destinations,
 * so the page imports no host route tree.
 */
export function PaymentDetailHost({ id }: PaymentDetailHostProps) {
  const messages = useOperatorAdminMessages()
  const { resolvedLocale } = useLocale()
  const navigateTo = useAdminNavigate()
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
        <Button variant="outline" onClick={() => navigateTo("payment.list", {})}>
          {detail.backToPayments}
        </Button>
      </div>
    )
  }

  const payment = data.data
  const fxRateLabel = formatFxRate(payment, resolvedLocale)

  // Subtitle surfaces the related document (invoice / booking number) so an
  // operator can recognise *what* this payment is for, but the page itself
  // is identified by the payment id — that's the record on screen.
  const relatedNumber = payment.kind === "customer" ? payment.invoiceNumber : payment.bookingNumber

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateTo("payment.list", {})}
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
              {fxRateLabel ? (
                <Row label={detail.fxRateLabel}>
                  <span className="font-mono">{fxRateLabel}</span>
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
                      <DestinationLink
                        destination="person.detail"
                        params={{ personId: payment.personId }}
                      >
                        {payment.personName}
                      </DestinationLink>
                    ) : payment.organizationId && payment.organizationName ? (
                      <DestinationLink
                        destination="organization.detail"
                        params={{ organizationId: payment.organizationId }}
                      >
                        {payment.organizationName}
                      </DestinationLink>
                    ) : (
                      noValue
                    )}
                  </Row>
                  {payment.personId &&
                  payment.personName &&
                  payment.organizationId &&
                  payment.organizationName ? (
                    <Row label={detail.organizationLabel}>
                      <DestinationLink
                        destination="organization.detail"
                        params={{ organizationId: payment.organizationId }}
                      >
                        {payment.organizationName}
                      </DestinationLink>
                    </Row>
                  ) : null}
                  <Row label={detail.invoiceLabel}>
                    {payment.invoiceId ? (
                      <DestinationLink
                        destination="invoice.detail"
                        params={{ invoiceId: payment.invoiceId }}
                      >
                        {payment.invoiceNumber ?? detail.viewInvoice}
                      </DestinationLink>
                    ) : (
                      noValue
                    )}
                  </Row>
                </>
              ) : (
                <>
                  <Row label={detail.paidToLabel}>
                    {payment.supplierId && payment.supplierName ? (
                      <DestinationLink
                        destination="supplier.detail"
                        params={{ supplierId: payment.supplierId }}
                      >
                        {payment.supplierName}
                      </DestinationLink>
                    ) : (
                      (payment.supplierName ?? noValue)
                    )}
                  </Row>
                  <Row label={detail.bookingLabel}>
                    {payment.bookingId ? (
                      <DestinationLink
                        destination="booking.detail"
                        params={{ bookingId: payment.bookingId }}
                      >
                        {payment.bookingNumber ?? detail.viewBooking}
                      </DestinationLink>
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
            <Row label={detail.createdLabel}>
              {new Date(payment.createdAt).toLocaleString(resolvedLocale)}
            </Row>
            <Row label={detail.updatedLabel}>
              {new Date(payment.updatedAt).toLocaleString(resolvedLocale)}
            </Row>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

function formatFxRate(
  payment: {
    amountCents: number
    currency: string
    baseAmountCents: number | null
    baseCurrency: string | null
  },
  locale: string,
) {
  if (
    payment.baseAmountCents === null ||
    !payment.baseCurrency ||
    payment.baseAmountCents <= 0 ||
    payment.currency === payment.baseCurrency
  ) {
    return null
  }

  const rate = payment.amountCents / payment.baseAmountCents
  return `1 ${payment.baseCurrency} = ${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 6,
  }).format(rate)} ${payment.currency}`
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}
