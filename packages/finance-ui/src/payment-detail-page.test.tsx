import type { UnifiedPaymentRecord } from "@voyantjs/finance-react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PaymentDetailHeader } from "./components/payment-detail-page.js"

function payment(data: Partial<UnifiedPaymentRecord> = {}): UnifiedPaymentRecord {
  return {
    kind: "customer",
    id: "pay_123",
    invoiceId: "inv_123",
    invoiceNumber: "INV-2026-001",
    bookingId: "book_123",
    bookingNumber: "BK-2026-001",
    supplierId: null,
    supplierName: null,
    personId: "per_123",
    personName: "Ana Pop",
    organizationId: null,
    organizationName: null,
    amountCents: 32000,
    currency: "RON",
    baseCurrency: null,
    baseAmountCents: null,
    paymentMethod: "bank_transfer",
    status: "completed",
    referenceNumber: null,
    paymentDate: "2026-05-26",
    notes: null,
    createdAt: "2026-05-26T00:00:00.000Z",
    updatedAt: "2026-05-26T00:00:00.000Z",
    ...data,
  }
}

describe("PaymentDetailHeader", () => {
  it("renders edit and delete actions when handlers are provided", () => {
    const html = renderToStaticMarkup(
      <PaymentDetailHeader payment={payment()} onEdit={() => {}} onDelete={async () => {}} />,
    )

    expect(html).toContain("Edit")
    expect(html).toContain("Delete")
    expect(html).toContain("pay_123")
  })

  it("omits edit and delete actions when handlers are absent", () => {
    const html = renderToStaticMarkup(<PaymentDetailHeader payment={payment()} />)

    expect(html).not.toContain("Edit")
    expect(html).not.toContain("Delete")
  })
})
