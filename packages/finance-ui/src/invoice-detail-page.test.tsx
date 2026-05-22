import type { InvoiceRecord } from "@voyantjs/finance-react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { InvoiceDetailHeader } from "./components/invoice-detail-page.js"

function invoice(data: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: "inv_123",
    invoiceNumber: "PF-2026-001",
    bookingId: "book_123",
    personId: null,
    organizationId: null,
    status: "draft",
    currency: "EUR",
    subtotalCents: 10000,
    taxCents: 1900,
    totalCents: 11900,
    paidCents: 0,
    balanceDueCents: 11900,
    issueDate: "2026-05-22",
    dueDate: "2026-06-01",
    notes: null,
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z",
    ...data,
  }
}

describe("InvoiceDetailHeader", () => {
  it("renders a localized type badge when invoiceType is present", () => {
    const html = renderToStaticMarkup(
      <InvoiceDetailHeader
        invoice={invoice({ invoiceType: "proforma" })}
        onEdit={() => {}}
        onDelete={async () => {}}
      />,
    )

    expect(html).toContain('data-slot="invoice-type-badge"')
    expect(html).toContain('data-invoice-type="proforma"')
    expect(html).toContain("Proforma")
  })

  it("does not render a type badge for legacy invoices without invoiceType", () => {
    const html = renderToStaticMarkup(
      <InvoiceDetailHeader invoice={invoice()} onEdit={() => {}} onDelete={async () => {}} />,
    )

    expect(html).not.toContain('data-slot="invoice-type-badge"')
  })
})
