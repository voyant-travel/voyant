import type { BookingRecord } from "@voyantjs/bookings-react"
import type { InvoiceAttachmentRecord, InvoiceRecord } from "@voyantjs/finance-react"
import type { LegalContractAttachmentRecord, LegalContractRecord } from "@voyantjs/legal-react"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const bookingsState = vi.hoisted(() => ({
  booking: null as BookingRecord | null,
}))

const financeState = vi.hoisted(() => ({
  invoices: [] as InvoiceRecord[],
  attachmentsByInvoiceId: {} as Record<string, InvoiceAttachmentRecord[]>,
}))

const legalState = vi.hoisted(() => ({
  contracts: [] as LegalContractRecord[],
  attachmentsByContractId: {} as Record<string, LegalContractAttachmentRecord[]>,
}))

vi.mock("@voyantjs/bookings-react", () => ({
  bookingStatusBadgeVariant: {
    confirmed: "default",
  },
  useBooking: () => ({
    data: { data: bookingsState.booking },
    fetchStatus: "idle",
  }),
  useTravelers: () => ({ data: { data: [] } }),
}))

vi.mock("@voyantjs/crm-react", () => ({
  useOrganization: () => ({ data: null }),
  usePerson: () => ({ data: null }),
}))

vi.mock("@voyantjs/finance-react", () => ({
  useAdminBookingPayments: () => ({ data: { data: { payments: [] } } }),
  useBookingPaymentSchedules: () => ({ data: { data: [] } }),
  useInvoices: () => ({ data: { data: financeState.invoices } }),
  useInvoiceAttachments: (invoiceId: string) => ({
    data: { data: financeState.attachmentsByInvoiceId[invoiceId] ?? [] },
  }),
}))

vi.mock("@voyantjs/legal-react", () => ({
  useLegalContracts: () => ({ data: { data: legalState.contracts } }),
  useLegalContractAttachments: ({ contractId }: { contractId: string }) => ({
    data: legalState.attachmentsByContractId[contractId] ?? [],
  }),
}))

vi.mock("@voyantjs/ui/components", () => ({
  Badge: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
  Button: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <button type="button" className={className}>
      {children}
    </button>
  ),
  Sheet: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetBody: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  SheetContent: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  SheetFooter: ({ children }: { children?: ReactNode }) => <footer>{children}</footer>,
  SheetHeader: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <header className={className}>{children}</header>
  ),
  SheetTitle: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}))

import { BookingQuickViewSheet } from "../../src/components/booking-quick-view-sheet.js"

beforeEach(() => {
  bookingsState.booking = null
  financeState.invoices = []
  financeState.attachmentsByInvoiceId = {}
  legalState.contracts = []
  legalState.attachmentsByContractId = {}
})

function booking(data: Partial<BookingRecord> = {}): BookingRecord {
  return {
    id: "book_123",
    bookingNumber: "BK-2026-000001",
    status: "confirmed",
    sellAmountCents: 12000,
    sellCurrency: "EUR",
    startDate: "2026-06-01",
    endDate: "2026-06-08",
    pax: 2,
    personId: null,
    organizationId: null,
    contactFirstName: null,
    contactLastName: null,
    contactPhone: null,
    ...data,
  } as BookingRecord
}

function invoice(data: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: "inv_123",
    bookingId: "book_123",
    invoiceNumber: "INV-2026-001",
    status: "issued",
    currency: "EUR",
    subtotalCents: 10000,
    taxCents: 2000,
    totalCents: 12000,
    paidCents: 0,
    balanceDueCents: 12000,
    issueDate: "2026-05-22",
    dueDate: "2026-06-01",
    notes: null,
    personId: null,
    organizationId: null,
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z",
    ...data,
  } as InvoiceRecord
}

function invoiceAttachment(data: Partial<InvoiceAttachmentRecord> = {}): InvoiceAttachmentRecord {
  return {
    id: "inv_att_123",
    invoiceId: "inv_123",
    kind: "document",
    name: "invoice.pdf",
    mimeType: "application/pdf",
    fileSize: 1024,
    storageKey: "invoices/inv_123/invoice.pdf",
    checksum: null,
    metadata: null,
    createdAt: "2026-05-22T00:00:00.000Z",
    ...data,
  }
}

function contract(data: Partial<LegalContractRecord> = {}): LegalContractRecord {
  return {
    id: "contract_123",
    bookingId: "book_123",
    contractNumber: "CTR-2026-001",
    title: "Travel contract",
    status: "issued",
    stage: "issued",
    stageHistory: [],
    templateId: "template_123",
    templateVersionId: "version_123",
    seriesId: null,
    personId: null,
    organizationId: null,
    supplierId: null,
    channelId: null,
    orderId: null,
    renderedBodyFormat: "html",
    renderedBody: null,
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z",
    ...data,
  } as LegalContractRecord
}

function contractAttachment(
  data: Partial<LegalContractAttachmentRecord> = {},
): LegalContractAttachmentRecord {
  return {
    id: "contract_att_123",
    contractId: "contract_123",
    kind: "document",
    name: "contract.pdf",
    mimeType: "application/pdf",
    fileSize: 2048,
    storageKey: "contracts/contract_123/contract.pdf",
    checksum: null,
    metadata: null,
    createdAt: "2026-05-22T00:00:00.000Z",
    ...data,
  }
}

describe("BookingQuickViewSheet", () => {
  it("links invoice and contract row titles to their latest attachment downloads", () => {
    bookingsState.booking = booking()
    financeState.invoices = [invoice()]
    financeState.attachmentsByInvoiceId.inv_123 = [
      invoiceAttachment({
        id: "old_invoice_attachment",
        createdAt: "2026-05-20T00:00:00.000Z",
      }),
      invoiceAttachment({
        id: "new_invoice_attachment",
        createdAt: "2026-05-21T00:00:00.000Z",
      }),
    ]
    legalState.contracts = [contract()]
    legalState.attachmentsByContractId.contract_123 = [
      contractAttachment({
        id: "old_contract_attachment",
        createdAt: "2026-05-20T00:00:00.000Z",
      }),
      contractAttachment({
        id: "new_contract_attachment",
        createdAt: "2026-05-21T00:00:00.000Z",
      }),
    ]

    const html = renderToStaticMarkup(
      <BookingQuickViewSheet bookingId="book_123" open onOpenChange={() => {}} />,
    )

    expect(html).toContain(
      'href="/v1/admin/finance/invoice-attachments/new_invoice_attachment/download"',
    )
    expect(html).toContain(
      'href="/v1/admin/legal/contracts/attachments/new_contract_attachment/download"',
    )
  })

  it("leaves invoice and contract row titles as text when no attachments exist", () => {
    bookingsState.booking = booking()
    financeState.invoices = [invoice()]
    legalState.contracts = [contract()]

    const html = renderToStaticMarkup(
      <BookingQuickViewSheet bookingId="book_123" open onOpenChange={() => {}} />,
    )

    expect(html).not.toContain("/v1/admin/finance/invoice-attachments/")
    expect(html).not.toContain("/v1/admin/legal/contracts/attachments/")
  })
})
