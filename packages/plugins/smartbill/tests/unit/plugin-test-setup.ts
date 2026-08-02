import { type Mock, vi } from "vitest"

interface FinanceServiceMock {
  listInvoiceExternalRefs: Mock
  registerInvoiceExternalRef: Mock
  applyExternalInvoiceAllocation: Mock
  updateInvoice: Mock
  listInvoiceAttachments: Mock
  createInvoiceRendition: Mock
  createInvoiceAttachment: Mock
  ensureExternalInvoiceNumberSeries: Mock
}

export const financeServiceMock: FinanceServiceMock = {
  listInvoiceExternalRefs: vi.fn(),
  registerInvoiceExternalRef: vi.fn(),
  applyExternalInvoiceAllocation: vi.fn(),
  updateInvoice: vi.fn(),
  listInvoiceAttachments: vi.fn(),
  createInvoiceRendition: vi.fn(),
  createInvoiceAttachment: vi.fn(),
  ensureExternalInvoiceNumberSeries: vi.fn(),
}

vi.doMock("@voyant-travel/finance", () => ({
  financeService: financeServiceMock,
}))
