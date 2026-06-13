import { vi } from "vitest"

import type { SmartbillClientApi } from "../../src/client.js"

import type { SmartbillWorkflowExternalRef } from "../../src/workflows.js"

export function makeClient(overrides: Partial<SmartbillClientApi> = {}): SmartbillClientApi {
  return {
    createInvoice: vi.fn(),
    createProforma: vi.fn(),
    cancelInvoice: vi.fn(),
    restoreInvoice: vi.fn(),
    deleteInvoice: vi.fn(),
    reverseInvoice: vi.fn(),
    viewInvoicePdf: vi.fn(),
    viewPdf: vi.fn(),
    viewEstimatePdf: vi.fn(),
    getPaymentStatus: vi.fn(),
    listTaxes: vi.fn(),
    listSeries: vi.fn(),
    listEstimateInvoices: vi.fn(),
    ...overrides,
  } as SmartbillClientApi
}

export function smartbillRef(
  overrides: Partial<SmartbillWorkflowExternalRef> = {},
): SmartbillWorkflowExternalRef {
  return {
    id: "iex_1",
    invoiceId: "inv_1",
    provider: "smartbill",
    externalId: "1",
    externalNumber: "1",
    externalUrl: null,
    status: "issued",
    syncError: null,
    metadata: {
      companyVatCode: "RO12345678",
      seriesName: "PF",
      series: "PF",
      number: "1",
      documentType: "proforma",
    },
    invoice: {
      id: "inv_1",
      invoiceNumber: "PF-1",
      invoiceType: "proforma",
      status: "sent",
      currency: "RON",
      totalCents: 10000,
      paidCents: 0,
      balanceDueCents: 10000,
    },
    ...overrides,
  }
}
