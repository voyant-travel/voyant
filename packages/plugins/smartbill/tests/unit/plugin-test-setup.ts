import { vi } from "vitest"

export const financeServiceMock = {
  listInvoiceExternalRefs: vi.fn(),
  registerInvoiceExternalRef: vi.fn(),
  applyExternalInvoiceAllocation: vi.fn(),
  updateInvoice: vi.fn(),
  listInvoiceAttachments: vi.fn(),
  createInvoiceRendition: vi.fn(),
  createInvoiceAttachment: vi.fn(),
  ensureExternalInvoiceNumberSeries: vi.fn(),
}

vi.doMock("@voyantjs/finance", () => ({
  financeService: financeServiceMock,
}))
