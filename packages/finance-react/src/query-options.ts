"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseAllPaymentsOptions } from "./hooks/use-all-payments.js"
import type { UseBookingGuaranteesOptions } from "./hooks/use-booking-guarantees.js"
import type { UseBookingPaymentSchedulesOptions } from "./hooks/use-booking-payment-schedules.js"
import type { UseInvoiceOptions } from "./hooks/use-invoice.js"
import type { UseInvoiceAttachmentsOptions } from "./hooks/use-invoice-attachments.js"
import type { UseInvoiceCreditNotesOptions } from "./hooks/use-invoice-credit-notes.js"
import type { UseInvoiceFxRateOptions } from "./hooks/use-invoice-fx-rate.js"
import type { UseInvoiceLineItemsOptions } from "./hooks/use-invoice-line-items.js"
import type { UseInvoiceNotesOptions } from "./hooks/use-invoice-notes.js"
import type { UseInvoiceNumberSeriesOptions } from "./hooks/use-invoice-number-series.js"
import type { UseInvoicePaymentsOptions } from "./hooks/use-invoice-payments.js"
import type { UseInvoicesOptions } from "./hooks/use-invoices.js"
import type { UsePaymentOptions } from "./hooks/use-payment.js"
import type { UsePublicBookingDocumentsOptions } from "./hooks/use-public-booking-documents.js"
import type { UsePublicBookingPaymentOptionsOptions } from "./hooks/use-public-booking-payment-options.js"
import type { UsePublicBookingPaymentsOptions } from "./hooks/use-public-booking-payments.js"
import type { UsePublicFinanceDocumentByReferenceOptions } from "./hooks/use-public-finance-document-by-reference.js"
import type { UsePublicPaymentSessionOptions } from "./hooks/use-public-payment-session.js"
import type { UseSupplierPaymentsOptions } from "./hooks/use-supplier-payments.js"
import type { UseVoucherOptions } from "./hooks/use-voucher.js"
import type { UseVouchersOptions } from "./hooks/use-vouchers.js"
import {
  getAdminBookingPayments,
  getInvoiceFxRate,
  getPublicBookingDocuments,
  getPublicBookingPaymentOptions,
  getPublicBookingPayments,
  getPublicFinanceDocumentByReference,
  getPublicPaymentSession,
} from "./operations.js"
import { financeQueryKeys } from "./query-keys.js"
import {
  allPaymentsListResponse,
  bookingGuaranteesResponse,
  bookingPaymentSchedulesResponse,
  invoiceAttachmentsResponse,
  invoiceCreditNotesResponse,
  invoiceLineItemsResponse,
  invoiceListResponse,
  invoiceNotesResponse,
  invoiceNumberSeriesListResponse,
  invoicePaymentsResponse,
  invoiceSingleResponse,
  paymentSingleResponse,
  supplierPaymentListResponse,
  voucherDetailResponse,
  voucherListResponse,
} from "./schemas.js"

export function getBookingPaymentSchedulesQueryOptions(
  client: FetchWithValidationOptions,
  bookingId: string | null | undefined,
  options: UseBookingPaymentSchedulesOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.bookingPaymentSchedules(bookingId ?? ""),
    queryFn: () =>
      fetchWithValidation(
        `/v1/finance/bookings/${bookingId}/payment-schedules`,
        bookingPaymentSchedulesResponse,
        client,
      ),
  })
}

export function getBookingGuaranteesQueryOptions(
  client: FetchWithValidationOptions,
  bookingId: string | null | undefined,
  options: UseBookingGuaranteesOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.bookingGuarantees(bookingId ?? ""),
    queryFn: () =>
      fetchWithValidation(
        `/v1/finance/bookings/${bookingId}/guarantees`,
        bookingGuaranteesResponse,
        client,
      ),
  })
}

export function getInvoiceFxRateQueryOptions(
  client: FetchWithValidationOptions,
  options: UseInvoiceFxRateOptions,
) {
  const { enabled: _enabled = true, ...input } = options

  return queryOptions({
    queryKey: financeQueryKeys.invoiceFxRate(input),
    queryFn: async () => {
      if (!input.baseCurrency || !input.quoteCurrency) {
        throw new Error("getInvoiceFxRateQueryOptions requires both currencies")
      }
      return getInvoiceFxRate(client, {
        baseCurrency: input.baseCurrency,
        quoteCurrency: input.quoteCurrency,
        date: input.date,
      })
    },
  })
}

export function getInvoicesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseInvoicesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: financeQueryKeys.invoicesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.bookingId) params.set("bookingId", filters.bookingId)
      if (filters.personId) params.set("personId", filters.personId)
      if (filters.organizationId) params.set("organizationId", filters.organizationId)
      if (filters.status) params.set("status", filters.status)
      if (filters.currency) params.set("currency", filters.currency)
      if (filters.dueDateFrom) params.set("dueDateFrom", filters.dueDateFrom)
      if (filters.dueDateTo) params.set("dueDateTo", filters.dueDateTo)
      if (filters.sortBy) params.set("sortBy", filters.sortBy)
      if (filters.sortDir) params.set("sortDir", filters.sortDir)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/finance/invoices${qs ? `?${qs}` : ""}`,
        invoiceListResponse,
        client,
      )
    },
  })
}

export function getInvoiceNumberSeriesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseInvoiceNumberSeriesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: financeQueryKeys.invoiceNumberSeriesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.scope) params.set("scope", filters.scope)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/admin/finance/invoice-number-series${qs ? `?${qs}` : ""}`,
        invoiceNumberSeriesListResponse,
        client,
      )
    },
  })
}

export function getAllPaymentsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseAllPaymentsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: financeQueryKeys.allPaymentsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.kind) params.set("kind", filters.kind)
      if (filters.status) params.set("status", filters.status)
      if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod)
      if (filters.currency) params.set("currency", filters.currency)
      if (filters.invoiceId) params.set("invoiceId", filters.invoiceId)
      if (filters.bookingId) params.set("bookingId", filters.bookingId)
      if (filters.supplierId) params.set("supplierId", filters.supplierId)
      if (filters.paymentDateFrom) params.set("paymentDateFrom", filters.paymentDateFrom)
      if (filters.paymentDateTo) params.set("paymentDateTo", filters.paymentDateTo)
      if (filters.search) params.set("search", filters.search)
      if (filters.sortBy) params.set("sortBy", filters.sortBy)
      if (filters.sortDir) params.set("sortDir", filters.sortDir)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/finance/payments${qs ? `?${qs}` : ""}`,
        allPaymentsListResponse,
        client,
      )
    },
  })
}

export function getPaymentQueryOptions(
  client: FetchWithValidationOptions,
  id: string | null | undefined,
  options: UsePaymentOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.payment(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("getPaymentQueryOptions requires an id")
      return fetchWithValidation(`/v1/finance/payments/${id}`, paymentSingleResponse, client)
    },
  })
}

export function getSupplierPaymentsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseSupplierPaymentsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: financeQueryKeys.supplierPaymentsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.bookingId) params.set("bookingId", filters.bookingId)
      if (filters.supplierId) params.set("supplierId", filters.supplierId)
      if (filters.status) params.set("status", filters.status)
      if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod)
      if (filters.currency) params.set("currency", filters.currency)
      if (filters.paymentDateFrom) params.set("paymentDateFrom", filters.paymentDateFrom)
      if (filters.paymentDateTo) params.set("paymentDateTo", filters.paymentDateTo)
      if (filters.sortBy) params.set("sortBy", filters.sortBy)
      if (filters.sortDir) params.set("sortDir", filters.sortDir)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/finance/supplier-payments${qs ? `?${qs}` : ""}`,
        supplierPaymentListResponse,
        client,
      )
    },
  })
}

export function getInvoiceQueryOptions(
  client: FetchWithValidationOptions,
  id: string | null | undefined,
  options: UseInvoiceOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.invoice(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("getInvoiceQueryOptions requires an id")
      return fetchWithValidation(`/v1/finance/invoices/${id}`, invoiceSingleResponse, client)
    },
  })
}

export function getInvoiceLineItemsQueryOptions(
  client: FetchWithValidationOptions,
  invoiceId: string | null | undefined,
  options: UseInvoiceLineItemsOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.lineItems(invoiceId ?? ""),
    queryFn: async () => {
      if (!invoiceId) throw new Error("getInvoiceLineItemsQueryOptions requires an invoiceId")
      return fetchWithValidation(
        `/v1/finance/invoices/${invoiceId}/line-items`,
        invoiceLineItemsResponse,
        client,
      )
    },
  })
}

export function getInvoicePaymentsQueryOptions(
  client: FetchWithValidationOptions,
  invoiceId: string | null | undefined,
  options: UseInvoicePaymentsOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.payments(invoiceId ?? ""),
    queryFn: async () => {
      if (!invoiceId) throw new Error("getInvoicePaymentsQueryOptions requires an invoiceId")
      return fetchWithValidation(
        `/v1/finance/invoices/${invoiceId}/payments`,
        invoicePaymentsResponse,
        client,
      )
    },
  })
}

export function getInvoiceCreditNotesQueryOptions(
  client: FetchWithValidationOptions,
  invoiceId: string | null | undefined,
  options: UseInvoiceCreditNotesOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.creditNotes(invoiceId ?? ""),
    queryFn: async () => {
      if (!invoiceId) throw new Error("getInvoiceCreditNotesQueryOptions requires an invoiceId")
      return fetchWithValidation(
        `/v1/finance/invoices/${invoiceId}/credit-notes`,
        invoiceCreditNotesResponse,
        client,
      )
    },
  })
}

export function getInvoiceNotesQueryOptions(
  client: FetchWithValidationOptions,
  invoiceId: string | null | undefined,
  options: UseInvoiceNotesOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.notes(invoiceId ?? ""),
    queryFn: async () => {
      if (!invoiceId) throw new Error("getInvoiceNotesQueryOptions requires an invoiceId")
      return fetchWithValidation(
        `/v1/finance/invoices/${invoiceId}/notes`,
        invoiceNotesResponse,
        client,
      )
    },
  })
}

export function getInvoiceAttachmentsQueryOptions(
  client: FetchWithValidationOptions,
  invoiceId: string | null | undefined,
  options: UseInvoiceAttachmentsOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.attachments(invoiceId ?? ""),
    queryFn: async () => {
      if (!invoiceId) throw new Error("getInvoiceAttachmentsQueryOptions requires an invoiceId")
      return fetchWithValidation(
        `/v1/finance/invoices/${invoiceId}/attachments`,
        invoiceAttachmentsResponse,
        client,
      )
    },
  })
}

export function getPublicBookingPaymentOptionsQueryOptions(
  client: FetchWithValidationOptions,
  bookingId: string | null | undefined,
  options: UsePublicBookingPaymentOptionsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: financeQueryKeys.publicBookingPaymentOptions(bookingId ?? "", filters),
    queryFn: async () => {
      if (!bookingId) {
        throw new Error("getPublicBookingPaymentOptionsQueryOptions requires a bookingId")
      }

      return getPublicBookingPaymentOptions(client, bookingId, filters)
    },
  })
}

export function getPublicBookingDocumentsQueryOptions(
  client: FetchWithValidationOptions,
  bookingId: string | null | undefined,
  options: UsePublicBookingDocumentsOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.publicBookingDocuments(bookingId ?? ""),
    queryFn: async () => {
      if (!bookingId) {
        throw new Error("getPublicBookingDocumentsQueryOptions requires a bookingId")
      }

      return getPublicBookingDocuments(client, bookingId)
    },
  })
}

export function getPublicFinanceDocumentByReferenceQueryOptions(
  client: FetchWithValidationOptions,
  reference: string | null | undefined,
  options: UsePublicFinanceDocumentByReferenceOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.publicFinanceDocumentLookup({ reference: reference ?? undefined }),
    queryFn: async () => {
      if (!reference) {
        throw new Error("getPublicFinanceDocumentByReferenceQueryOptions requires a reference")
      }

      return getPublicFinanceDocumentByReference(client, { reference })
    },
  })
}

export function getPublicBookingPaymentsQueryOptions(
  client: FetchWithValidationOptions,
  bookingId: string | null | undefined,
  options: UsePublicBookingPaymentsOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.publicBookingPayments(bookingId ?? ""),
    queryFn: async () => {
      if (!bookingId) {
        throw new Error("getPublicBookingPaymentsQueryOptions requires a bookingId")
      }

      return getPublicBookingPayments(client, bookingId)
    },
  })
}

export function getAdminBookingPaymentsQueryOptions(
  client: FetchWithValidationOptions,
  bookingId: string | null | undefined,
) {
  return queryOptions({
    queryKey: financeQueryKeys.adminBookingPayments(bookingId ?? ""),
    queryFn: async () => {
      if (!bookingId) {
        throw new Error("getAdminBookingPaymentsQueryOptions requires a bookingId")
      }
      return getAdminBookingPayments(client, bookingId)
    },
  })
}

export function getPublicPaymentSessionQueryOptions(
  client: FetchWithValidationOptions,
  sessionId: string | null | undefined,
  options: UsePublicPaymentSessionOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.publicPaymentSession(sessionId ?? ""),
    queryFn: async () => {
      if (!sessionId) {
        throw new Error("getPublicPaymentSessionQueryOptions requires a sessionId")
      }

      return getPublicPaymentSession(client, sessionId)
    },
  })
}

export function getVouchersQueryOptions(
  client: FetchWithValidationOptions,
  options: UseVouchersOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: financeQueryKeys.vouchersList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.status) params.set("status", filters.status)
      if (filters.issuedToPersonId) params.set("issuedToPersonId", filters.issuedToPersonId)
      if (filters.issuedToOrganizationId) {
        params.set("issuedToOrganizationId", filters.issuedToOrganizationId)
      }
      if (filters.search) params.set("search", filters.search)
      if (filters.hasBalance !== undefined) params.set("hasBalance", String(filters.hasBalance))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/finance/vouchers${qs ? `?${qs}` : ""}`,
        voucherListResponse,
        client,
      )
    },
  })
}

export function getVoucherQueryOptions(
  client: FetchWithValidationOptions,
  id: string | null | undefined,
  options: UseVoucherOptions = {},
) {
  const { enabled: _enabled = true } = options

  return queryOptions({
    queryKey: financeQueryKeys.voucher(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("getVoucherQueryOptions requires an id")
      return fetchWithValidation(`/v1/finance/vouchers/${id}`, voucherDetailResponse, client)
    },
  })
}

export {
  getInvoiceActionLedgerQueryOptions,
  getPaymentSessionActionLedgerQueryOptions,
  type UseFinanceActionLedgerOptions,
} from "./query-options-action-ledger.js"
