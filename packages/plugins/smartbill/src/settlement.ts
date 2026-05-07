import type { SmartbillClientOptions } from "./client.js"
import { createSmartbillClient } from "./client.js"

export interface SmartbillInvoiceSettlementPollerOptions extends SmartbillClientOptions {
  companyVatCode?: string
  seriesName?: string
}

export interface SmartbillSettlementInvoice {
  invoiceNumber: string
}

export interface SmartbillSettlementExternalRef {
  externalId: string | null
  externalNumber: string | null
  metadata?: unknown
}

export interface SmartbillSettlementPollerContext {
  invoice: SmartbillSettlementInvoice
  externalRef: SmartbillSettlementExternalRef
}

export interface SmartbillSettlementPollerResult {
  externalId?: string | null
  externalNumber?: string | null
  status?: string | null
  paidAmountCents?: number | null
  unpaidAmountCents?: number | null
  settledAt?: string | null
  syncError?: string | null
  metadata?: Record<string, unknown> | null
}

export type SmartbillInvoiceSettlementPoller = (
  context: SmartbillSettlementPollerContext,
) => Promise<SmartbillSettlementPollerResult>

function coerceString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function coerceMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function resolveCompanyVatCode(
  metadata: Record<string, unknown> | null,
  options: SmartbillInvoiceSettlementPollerOptions,
) {
  return (
    coerceString(metadata?.companyVatCode) ??
    coerceString(metadata?.vatCode) ??
    options.companyVatCode ??
    null
  )
}

function resolveSeriesName(
  metadata: Record<string, unknown> | null,
  options: SmartbillInvoiceSettlementPollerOptions,
) {
  return (
    coerceString(metadata?.seriesName) ??
    coerceString(metadata?.series) ??
    options.seriesName ??
    null
  )
}

function resolveInvoiceNumber(
  metadata: Record<string, unknown> | null,
  externalNumber: string | null,
  externalId: string | null,
  invoiceNumber: string,
) {
  return (
    coerceString(metadata?.number) ??
    coerceString(metadata?.invoiceNumber) ??
    externalNumber ??
    externalId ??
    invoiceNumber
  )
}

function toCents(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : null
}

export function createSmartbillInvoiceSettlementPoller(
  options: SmartbillInvoiceSettlementPollerOptions,
): SmartbillInvoiceSettlementPoller {
  const client = createSmartbillClient(options)

  return async ({ invoice, externalRef }) => {
    const metadata = coerceMetadata(externalRef.metadata)
    const companyVatCode = resolveCompanyVatCode(metadata, options)
    const seriesName = resolveSeriesName(metadata, options)
    const number = resolveInvoiceNumber(
      metadata,
      externalRef.externalNumber,
      externalRef.externalId,
      invoice.invoiceNumber,
    )

    if (!companyVatCode) {
      return { syncError: "SmartBill settlement polling requires companyVatCode" }
    }

    if (!seriesName) {
      return { syncError: "SmartBill settlement polling requires seriesName" }
    }

    const status = await client.getPaymentStatus(companyVatCode, seriesName, number)
    const paid = status.paid === true

    return {
      externalId: externalRef.externalId ?? null,
      externalNumber: number,
      status: paid ? "paid" : "unpaid",
      paidAmountCents: toCents(status.paidAmount),
      unpaidAmountCents: toCents(status.unpaidAmount),
      settledAt:
        paid && typeof status.paidAmount === "number" && status.paidAmount > 0
          ? new Date().toISOString()
          : null,
      syncError: status.errorText ? status.errorText : null,
      metadata: {
        ...(metadata ?? {}),
        companyVatCode,
        seriesName,
      },
    }
  }
}
