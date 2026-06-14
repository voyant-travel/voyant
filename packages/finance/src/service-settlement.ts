import type { EventBus } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { Invoice as FinanceInvoice, InvoiceExternalRef } from "./schema.js"
import { financeService } from "./service.js"
import type { PolledInvoiceSettlementResult, PollInvoiceSettlementInput } from "./validation.js"

type SettlementInvoice = FinanceInvoice
type SettlementExternalRef = InvoiceExternalRef

export interface InvoiceSettlementPollerContext {
  db: PostgresJsDatabase
  invoice: SettlementInvoice
  externalRef: SettlementExternalRef
  bindings: Record<string, unknown>
}

export interface InvoiceSettlementPollerResult {
  externalId?: string | null
  externalNumber?: string | null
  externalUrl?: string | null
  status?: string | null
  paidAmountCents?: number | null
  unpaidAmountCents?: number | null
  syncedAt?: string | Date | null
  settledAt?: string | Date | null
  referenceNumber?: string | null
  syncError?: string | null
  metadata?: Record<string, unknown> | null
}

export type InvoiceSettlementPoller = (
  context: InvoiceSettlementPollerContext,
) => Promise<InvoiceSettlementPollerResult>

export interface FinanceSettlementRuntimeOptions {
  bindings?: Record<string, unknown>
  invoiceSettlementPollers?: Record<string, InvoiceSettlementPoller>
  eventBus?: EventBus
}

export interface InvoiceSettledEvent {
  invoiceId: string
  paymentId: string
  provider: string
  newlyAppliedAmountCents: number
  paidCents: number
  balanceDueCents: number
}

function coerceRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function toIsoString(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function normalizeMoney(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null
  return Math.round(value)
}

function resolveReferenceNumber(
  input: PollInvoiceSettlementInput,
  pollResult: InvoiceSettlementPollerResult,
  externalRef: SettlementExternalRef,
  invoice: SettlementInvoice,
) {
  return (
    input.referenceNumber ??
    pollResult.referenceNumber ??
    pollResult.externalNumber ??
    pollResult.externalId ??
    externalRef.externalNumber ??
    externalRef.externalId ??
    invoice.invoiceNumber
  )
}

function resolvePaymentDate(
  input: PollInvoiceSettlementInput,
  pollResult: InvoiceSettlementPollerResult,
) {
  return (
    input.paymentDate ??
    toIsoString(pollResult.settledAt) ??
    toIsoString(pollResult.syncedAt) ??
    new Date().toISOString()
  )
}

async function synchronizeExternalRef(
  db: PostgresJsDatabase,
  invoiceId: string,
  externalRef: SettlementExternalRef,
  pollResult: InvoiceSettlementPollerResult,
) {
  const syncedAt = toIsoString(pollResult.syncedAt) ?? new Date().toISOString()
  const row = await financeService.registerInvoiceExternalRef(db, invoiceId, {
    provider: externalRef.provider,
    externalId: pollResult.externalId ?? externalRef.externalId ?? null,
    externalNumber: pollResult.externalNumber ?? externalRef.externalNumber ?? null,
    externalUrl: pollResult.externalUrl ?? externalRef.externalUrl ?? null,
    status: pollResult.status ?? externalRef.status ?? null,
    metadata: pollResult.metadata ?? coerceRecord(externalRef.metadata) ?? null,
    syncedAt,
    syncError: pollResult.syncError ?? null,
  })

  return {
    row,
    syncedAt,
  }
}

export const financeSettlementService = {
  async pollInvoiceSettlement(
    db: PostgresJsDatabase,
    invoiceId: string,
    input: PollInvoiceSettlementInput,
    runtime: FinanceSettlementRuntimeOptions = {},
  ): Promise<PolledInvoiceSettlementResult | { status: "not_found" }> {
    let invoice = await financeService.getInvoiceById(db, invoiceId)
    if (!invoice) {
      return { status: "not_found" }
    }

    const externalRefs = await financeService.listInvoiceExternalRefs(db, invoiceId)
    const refsToPoll = input.provider
      ? externalRefs.filter((externalRef) => externalRef.provider === input.provider)
      : externalRefs

    const results: PolledInvoiceSettlementResult["results"] = []

    for (const externalRef of refsToPoll) {
      const poller = runtime.invoiceSettlementPollers?.[externalRef.provider]
      if (!poller) {
        const synced = await synchronizeExternalRef(db, invoice.id, externalRef, {
          syncError: "No settlement poller configured",
        })

        results.push({
          provider: externalRef.provider,
          externalRefId: synced.row?.id ?? externalRef.id,
          externalId: synced.row?.externalId ?? externalRef.externalId ?? null,
          externalNumber: synced.row?.externalNumber ?? externalRef.externalNumber ?? null,
          externalUrl: synced.row?.externalUrl ?? externalRef.externalUrl ?? null,
          status: synced.row?.status ?? externalRef.status ?? null,
          paidAmountCents: null,
          unpaidAmountCents: null,
          syncedAt: toIsoString(synced.row?.syncedAt) ?? synced.syncedAt,
          settledAt: null,
          createdPaymentId: null,
          newlyAppliedAmountCents: 0,
          syncError: synced.row?.syncError ?? "No settlement poller configured",
        })
        continue
      }

      try {
        const pollResult = await poller({
          db,
          invoice,
          externalRef,
          bindings: runtime.bindings ?? {},
        })

        const synced = await synchronizeExternalRef(db, invoice.id, externalRef, pollResult)
        const paidAmountCents = normalizeMoney(pollResult.paidAmountCents)
        const unpaidAmountCents = normalizeMoney(pollResult.unpaidAmountCents)
        let newlyAppliedAmountCents = 0
        let createdPaymentId: string | null = null

        if (input.reconcilePayment && paidAmountCents !== null) {
          const cappedPaidAmountCents = Math.min(invoice.totalCents, Math.max(0, paidAmountCents))
          const outstandingAmountCents = Math.max(0, invoice.totalCents - invoice.paidCents)
          newlyAppliedAmountCents = Math.min(
            outstandingAmountCents,
            Math.max(0, cappedPaidAmountCents - invoice.paidCents),
          )

          if (newlyAppliedAmountCents > 0) {
            const payment = await financeService.createPayment(db, invoice.id, {
              amountCents: newlyAppliedAmountCents,
              currency: invoice.currency,
              baseCurrency: invoice.baseCurrency ?? null,
              baseAmountCents:
                invoice.baseCurrency && invoice.baseCurrency === invoice.currency
                  ? newlyAppliedAmountCents
                  : null,
              fxRateSetId: invoice.fxRateSetId ?? null,
              paymentMethod: input.paymentMethod,
              paymentInstrumentId: null,
              paymentAuthorizationId: null,
              paymentCaptureId: null,
              status: "completed",
              referenceNumber: resolveReferenceNumber(input, pollResult, externalRef, invoice),
              paymentDate: resolvePaymentDate(input, pollResult),
              notes:
                input.notes ??
                `Settlement reconciled from ${externalRef.provider} external reference`,
            })

            createdPaymentId = payment?.id ?? null
            invoice = (await financeService.getInvoiceById(db, invoice.id)) ?? invoice

            if (createdPaymentId) {
              await runtime.eventBus?.emit(
                "invoice.settled",
                {
                  invoiceId: invoice.id,
                  paymentId: createdPaymentId,
                  provider: externalRef.provider,
                  newlyAppliedAmountCents,
                  paidCents: invoice.paidCents,
                  balanceDueCents: invoice.balanceDueCents,
                } satisfies InvoiceSettledEvent,
                {
                  category: "domain",
                  source: "service",
                },
              )
            }
          }
        }

        results.push({
          provider: externalRef.provider,
          externalRefId: synced.row?.id ?? externalRef.id,
          externalId: synced.row?.externalId ?? externalRef.externalId ?? null,
          externalNumber: synced.row?.externalNumber ?? externalRef.externalNumber ?? null,
          externalUrl: synced.row?.externalUrl ?? externalRef.externalUrl ?? null,
          status: synced.row?.status ?? externalRef.status ?? null,
          paidAmountCents,
          unpaidAmountCents,
          syncedAt: toIsoString(synced.row?.syncedAt) ?? synced.syncedAt,
          settledAt: toIsoString(pollResult.settledAt),
          createdPaymentId,
          newlyAppliedAmountCents,
          syncError: synced.row?.syncError ?? pollResult.syncError ?? null,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Settlement polling failed"
        const synced = await synchronizeExternalRef(db, invoice.id, externalRef, {
          syncError: message,
        })

        results.push({
          provider: externalRef.provider,
          externalRefId: synced.row?.id ?? externalRef.id,
          externalId: synced.row?.externalId ?? externalRef.externalId ?? null,
          externalNumber: synced.row?.externalNumber ?? externalRef.externalNumber ?? null,
          externalUrl: synced.row?.externalUrl ?? externalRef.externalUrl ?? null,
          status: synced.row?.status ?? externalRef.status ?? null,
          paidAmountCents: null,
          unpaidAmountCents: null,
          syncedAt: toIsoString(synced.row?.syncedAt) ?? synced.syncedAt,
          settledAt: null,
          createdPaymentId: null,
          newlyAppliedAmountCents: 0,
          syncError: synced.row?.syncError ?? message,
        })
      }
    }

    invoice = (await financeService.getInvoiceById(db, invoice.id)) ?? invoice

    return {
      invoiceId: invoice.id,
      invoiceStatus: invoice.status,
      paidCents: invoice.paidCents,
      balanceDueCents: invoice.balanceDueCents,
      results,
    }
  },
}
