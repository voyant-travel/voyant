export type FinanceInvoiceListSortField =
  | "invoiceNumber"
  | "status"
  | "totalCents"
  | "paidCents"
  | "balanceDueCents"
  | "issueDate"
  | "dueDate"
  | "createdAt"

export type FinanceInvoiceListSortDir = "asc" | "desc"

export interface FinanceInvoiceListFilters {
  search?: string | undefined
  /**
   * Filter to invoices for a specific booking. Drives the booking
   * detail page's "Facturi" card. Server-side check is by exact
   * `bookings.id`, no fuzzy matching.
   */
  bookingId?: string | undefined
  /** Filter by invoice status (draft, sent, paid, …). */
  status?: string | undefined
  personId?: string | undefined
  organizationId?: string | undefined
  currency?: string | undefined
  dueDateFrom?: string | undefined
  dueDateTo?: string | undefined
  sortBy?: FinanceInvoiceListSortField | undefined
  sortDir?: FinanceInvoiceListSortDir | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export type FinanceSupplierPaymentListSortField =
  | "amountCents"
  | "status"
  | "paymentDate"
  | "createdAt"

export type FinanceSupplierPaymentListSortDir = "asc" | "desc"

export interface FinanceSupplierPaymentListFilters {
  bookingId?: string | undefined
  supplierId?: string | undefined
  status?: string | undefined
  paymentMethod?: string | undefined
  currency?: string | undefined
  paymentDateFrom?: string | undefined
  paymentDateTo?: string | undefined
  sortBy?: FinanceSupplierPaymentListSortField | undefined
  sortDir?: FinanceSupplierPaymentListSortDir | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export type FinancePaymentKind = "customer" | "supplier"

export type FinanceAllPaymentsListSortField = "amountCents" | "status" | "paymentDate" | "createdAt"

export type FinanceAllPaymentsListSortDir = "asc" | "desc"

export interface FinanceAllPaymentsListFilters {
  kind?: FinancePaymentKind | undefined
  status?: string | undefined
  paymentMethod?: string | undefined
  currency?: string | undefined
  invoiceId?: string | undefined
  bookingId?: string | undefined
  supplierId?: string | undefined
  paymentDateFrom?: string | undefined
  paymentDateTo?: string | undefined
  search?: string | undefined
  sortBy?: FinanceAllPaymentsListSortField | undefined
  sortDir?: FinanceAllPaymentsListSortDir | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface FinanceVoucherListFilters {
  status?: string | undefined
  issuedToPersonId?: string | undefined
  issuedToOrganizationId?: string | undefined
  search?: string | undefined
  hasBalance?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface PublicBookingPaymentOptionsFilters {
  personId?: string | undefined
  organizationId?: string | undefined
  provider?: string | undefined
  instrumentType?: string | undefined
  includeInactive?: boolean | undefined
}

export interface PublicFinanceDocumentLookupFilters {
  reference?: string | undefined
}

export const financeQueryKeys = {
  all: ["voyant", "finance"] as const,

  invoices: () => [...financeQueryKeys.all, "invoices"] as const,
  invoicesList: (filters: FinanceInvoiceListFilters) =>
    [...financeQueryKeys.invoices(), "list", filters] as const,
  invoice: (id: string) => [...financeQueryKeys.invoices(), "detail", id] as const,
  lineItems: (invoiceId: string) => [...financeQueryKeys.invoice(invoiceId), "line-items"] as const,
  payments: (invoiceId: string) => [...financeQueryKeys.invoice(invoiceId), "payments"] as const,
  creditNotes: (invoiceId: string) =>
    [...financeQueryKeys.invoice(invoiceId), "credit-notes"] as const,
  notes: (invoiceId: string) => [...financeQueryKeys.invoice(invoiceId), "notes"] as const,

  bookingPaymentSchedules: (bookingId: string) =>
    [...financeQueryKeys.all, "booking-payment-schedules", bookingId] as const,
  bookingGuarantees: (bookingId: string) =>
    [...financeQueryKeys.all, "booking-guarantees", bookingId] as const,

  supplierPayments: () => [...financeQueryKeys.all, "supplier-payments"] as const,
  supplierPaymentsList: (filters: FinanceSupplierPaymentListFilters) =>
    [...financeQueryKeys.supplierPayments(), "list", filters] as const,

  allPayments: () => [...financeQueryKeys.all, "all-payments"] as const,
  allPaymentsList: (filters: FinanceAllPaymentsListFilters) =>
    [...financeQueryKeys.allPayments(), "list", filters] as const,
  payment: (id: string) => [...financeQueryKeys.allPayments(), "detail", id] as const,

  publicCheckout: () => [...financeQueryKeys.all, "public-checkout"] as const,
  publicFinanceDocumentLookup: (filters: PublicFinanceDocumentLookupFilters) =>
    [...financeQueryKeys.publicCheckout(), "document-lookup", filters] as const,
  publicBookingDocuments: (bookingId: string) =>
    [...financeQueryKeys.publicCheckout(), "booking-documents", bookingId] as const,
  publicBookingPayments: (bookingId: string) =>
    [...financeQueryKeys.publicCheckout(), "booking-payments", bookingId] as const,
  adminBookingPayments: (bookingId: string) =>
    [...financeQueryKeys.all, "admin-booking-payments", bookingId] as const,
  publicBookingPaymentOptions: (bookingId: string, filters: PublicBookingPaymentOptionsFilters) =>
    [...financeQueryKeys.publicCheckout(), "booking-payment-options", bookingId, filters] as const,
  publicPaymentSession: (sessionId: string) =>
    [...financeQueryKeys.publicCheckout(), "payment-session", sessionId] as const,
  publicVoucherValidation: () =>
    [...financeQueryKeys.publicCheckout(), "voucher-validation"] as const,

  vouchers: () => [...financeQueryKeys.all, "vouchers"] as const,
  vouchersList: (filters: FinanceVoucherListFilters) =>
    [...financeQueryKeys.vouchers(), "list", filters] as const,
  voucher: (id: string) => [...financeQueryKeys.vouchers(), "detail", id] as const,
} as const
