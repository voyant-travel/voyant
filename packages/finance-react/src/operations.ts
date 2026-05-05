"use client"

import { type FetchWithValidationOptions, fetchWithValidation, withQueryParams } from "./client.js"
import {
  type PublicFinanceDocumentLookupQuery,
  type PublicStartPaymentSessionInput,
  type PublicValidateVoucherInput,
  publicBookingFinanceDocumentsResponse,
  publicBookingFinancePaymentsResponse,
  publicBookingPaymentOptionsResponse,
  publicFinanceDocumentLookupResponse,
  publicPaymentSessionResponse,
  publicVoucherValidationResponse,
} from "./schemas.js"

export function getPublicFinanceDocumentByReference(
  client: FetchWithValidationOptions,
  query: PublicFinanceDocumentLookupQuery,
) {
  return fetchWithValidation(
    withQueryParams("/v1/public/finance/documents/by-reference", query),
    publicFinanceDocumentLookupResponse,
    client,
  )
}

export function getPublicBookingDocuments(client: FetchWithValidationOptions, bookingId: string) {
  return fetchWithValidation(
    `/v1/public/finance/bookings/${bookingId}/documents`,
    publicBookingFinanceDocumentsResponse,
    client,
  )
}

export function getPublicBookingPayments(client: FetchWithValidationOptions, bookingId: string) {
  return fetchWithValidation(
    `/v1/public/finance/bookings/${bookingId}/payments`,
    publicBookingFinancePaymentsResponse,
    client,
  )
}

/**
 * Admin variant — same response shape as `getPublicBookingPayments`,
 * but hits the admin endpoint (`/v1/admin/finance/bookings/:id/payments`)
 * so a staff actor can read it. The customer-portal continues to use
 * the public path; the operator dashboard uses this one.
 */
export function getAdminBookingPayments(client: FetchWithValidationOptions, bookingId: string) {
  return fetchWithValidation(
    `/v1/admin/finance/bookings/${bookingId}/payments`,
    publicBookingFinancePaymentsResponse,
    client,
  )
}

export function getPublicBookingPaymentOptions(
  client: FetchWithValidationOptions,
  bookingId: string,
  filters?: {
    personId?: string
    organizationId?: string
    provider?: string
    instrumentType?: string
    includeInactive?: boolean
  },
) {
  return fetchWithValidation(
    withQueryParams(`/v1/public/finance/bookings/${bookingId}/payment-options`, filters),
    publicBookingPaymentOptionsResponse,
    client,
  )
}

export function getPublicPaymentSession(client: FetchWithValidationOptions, sessionId: string) {
  return fetchWithValidation(
    `/v1/public/finance/payment-sessions/${sessionId}`,
    publicPaymentSessionResponse,
    client,
  )
}

export function startPublicBookingSchedulePaymentSession(
  client: FetchWithValidationOptions,
  bookingId: string,
  scheduleId: string,
  input: PublicStartPaymentSessionInput,
) {
  return fetchWithValidation(
    `/v1/public/finance/bookings/${bookingId}/payment-schedules/${scheduleId}/payment-session`,
    publicPaymentSessionResponse,
    client,
    { method: "POST", body: JSON.stringify(input) },
  )
}

export function startPublicBookingGuaranteePaymentSession(
  client: FetchWithValidationOptions,
  bookingId: string,
  guaranteeId: string,
  input: PublicStartPaymentSessionInput,
) {
  return fetchWithValidation(
    `/v1/public/finance/bookings/${bookingId}/guarantees/${guaranteeId}/payment-session`,
    publicPaymentSessionResponse,
    client,
    { method: "POST", body: JSON.stringify(input) },
  )
}

export function validatePublicVoucher(
  client: FetchWithValidationOptions,
  input: PublicValidateVoucherInput,
) {
  return fetchWithValidation(
    "/v1/public/finance/vouchers/validate",
    publicVoucherValidationResponse,
    client,
    { method: "POST", body: JSON.stringify(input) },
  )
}
