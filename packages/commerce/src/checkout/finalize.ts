// agent-quality: file-size exception -- owner: commerce; the checkout-finalize
// step wiring (confirm booking, issue invoice, link payments, contract PDF) is
// one cohesive workflow definition; splitting it would scatter a single saga.
import { bookingsService } from "@voyant-travel/bookings"
import { bookingActivityLog, bookings } from "@voyant-travel/bookings/schema"
import {
  type CheckoutFinalizeDeps,
  type CheckoutFinalizeInput,
  runCheckoutFinalize,
} from "@voyant-travel/catalog/booking-engine"
import type { EventBus } from "@voyant-travel/core"
import {
  convertProformaToInvoice,
  issueInvoiceFromBooking,
  settleCoveredBookingPaymentSchedules,
} from "@voyant-travel/finance"
import { beginWorkflowRun, type WorkflowRunRecorder } from "@voyant-travel/workflow-runs"
import { and, desc, eq, isNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

/**
 * Optional callback that generates (or fetches existing) the contract PDF for
 * a booking. Wired by the deployment and forwarded into the explicit
 * `generate_contract_pdf` workflow step. The deployment supplies its
 * platform bindings (`env`) when constructing it, so this package-level type
 * only carries the booking-scoped inputs the step needs.
 */
export type CatalogCheckoutContractPdfGenerator = (input: {
  db: PostgresJsDatabase
  eventBus: EventBus
  bookingId: string
  force?: boolean
}) => Promise<{ contractId: string; attachmentId: string } | null>

function buildCheckoutFinalizeDeps(
  db: PostgresJsDatabase,
  eventBus: EventBus,
  recorder: WorkflowRunRecorder,
  generateContractPdf?: CatalogCheckoutContractPdfGenerator,
): CheckoutFinalizeDeps {
  return {
    db,
    eventBus,
    recorder: {
      startStep: (name) => {
        void recorder.startStep(name)
      },
      completeStep: (name, output) => {
        void recorder.completeStep(name, output ?? null)
      },
      failStep: (name, error) => {
        void recorder.failStep(name, error)
      },
    },
    confirmBooking: async (bookingId) => {
      const result = await bookingsService.confirmBooking(db, bookingId, {}, undefined, {
        eventBus,
      })
      if (result.status === "ok") return

      if (result.status === "hold_expired") {
        const recovered = await bookingsService.recoverExpiredPaidBooking(
          db,
          bookingId,
          { note: "Recovered after late payment completion" },
          undefined,
          { eventBus },
        )
        if (recovered.status === "ok") return
        throw new Error(`checkout-finalize: late payment recovery failed (${recovered.status})`)
      }

      throw new Error(`checkout-finalize: booking confirmation failed (${result.status})`)
    },
    issueInvoice: async ({ bookingId, convertedFromInvoiceId }) => {
      if (convertedFromInvoiceId) {
        const result = await convertProformaToInvoice(db, convertedFromInvoiceId, {}, { eventBus })
        if (result.status === "ok") return { invoiceId: result.invoice.id }
        if (result.status === "already_converted" && result.invoice) {
          return { invoiceId: result.invoice.id }
        }
        throw new Error(`checkout-finalize: proforma conversion failed (${result.status})`)
      }

      const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
      if (!booking) return null

      const { bookingItems } = await import("@voyant-travel/bookings/schema")
      const items = await db
        .select()
        .from(bookingItems)
        .where(eq(bookingItems.bookingId, bookingId))

      const today = new Date().toISOString().slice(0, 10)
      const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      // Finalize runs on payment.completed, i.e. the money has settled.
      // The fiscal invoice is always issued here. The document-flow choice
      // (proforma-first vs direct) is made earlier, at order placement, and
      // is scoped to the deferred bank-transfer path — never card. When a
      // proforma was issued at placement it is converted above via
      // `convertProformaToInvoice`; this branch only runs for the direct
      // path, where no proforma exists.
      const invoice = await issueInvoiceFromBooking(
        db,
        {
          bookingId,
          issueDate: today,
          dueDate,
          invoiceType: "invoice",
          convertedFromInvoiceId,
          notes: convertedFromInvoiceId
            ? `Converted from proforma ${convertedFromInvoiceId}`
            : null,
        },
        {
          booking: {
            id: booking.id,
            bookingNumber: booking.bookingNumber,
            personId: booking.personId,
            organizationId: booking.organizationId,
            sellCurrency: booking.sellCurrency,
            baseCurrency: booking.baseCurrency,
            fxRateSetId: null,
            sellAmountCents: booking.sellAmountCents,
            baseSellAmountCents: booking.baseSellAmountCents,
          },
          items: items.map((item) => ({
            id: item.id,
            title: item.title,
            quantity: item.quantity,
            unitSellAmountCents: item.unitSellAmountCents,
            totalSellAmountCents: item.totalSellAmountCents,
          })),
        },
        { eventBus },
      )

      return invoice ? { invoiceId: invoice.id } : null
    },
    findProformaForBooking: async (bookingId) => {
      const { invoices } = await import("@voyant-travel/finance")
      const [proforma] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.bookingId, bookingId),
            eq(invoices.invoiceType, "proforma"),
            eq(invoices.status, "paid"),
          ),
        )
        .orderBy(desc(invoices.createdAt))
        .limit(1)
      return proforma ? { invoiceId: proforma.id } : null
    },
    generateContractPdf: generateContractPdf
      ? async ({ bookingId, force }) => generateContractPdf({ db, eventBus, bookingId, force })
      : undefined,
    linkPaymentToInvoice: async ({ bookingId, invoiceId, paymentSessionId }) => {
      const { paymentSessions } = await import("@voyant-travel/finance/schema")
      const { financeService } = await import("@voyant-travel/finance")
      const paidSessions = await db
        .select()
        .from(paymentSessions)
        .where(
          and(
            eq(paymentSessions.bookingId, bookingId),
            eq(paymentSessions.status, "paid"),
            isNull(paymentSessions.invoiceId),
          ),
        )

      let firstPaymentId: string | null = null
      let sessionsLinked = 0

      for (const session of paidSessions) {
        await db
          .update(paymentSessions)
          .set({ invoiceId, updatedAt: new Date() })
          .where(eq(paymentSessions.id, session.id))

        const payment = await financeService.createPayment(db, invoiceId, {
          amountCents: session.amountCents,
          currency: session.currency,
          paymentMethod: session.paymentMethod ?? "credit_card",
          paymentInstrumentId: session.paymentInstrumentId ?? null,
          paymentAuthorizationId: session.paymentAuthorizationId ?? null,
          paymentCaptureId: session.paymentCaptureId ?? null,
          status: "completed",
          referenceNumber:
            session.providerPaymentId ??
            session.externalReference ??
            session.providerSessionId ??
            session.id,
          paymentDate: (session.completedAt ?? new Date()).toISOString().slice(0, 10),
          notes:
            `Checkout-finalize linkage from session ${session.id}` +
            (paymentSessionId && session.id !== paymentSessionId
              ? ` (workflow input session: ${paymentSessionId})`
              : ""),
        })

        if (payment?.id) {
          await db
            .update(paymentSessions)
            .set({ paymentId: payment.id, updatedAt: new Date() })
            .where(eq(paymentSessions.id, session.id))
          if (!firstPaymentId) firstPaymentId = payment.id
        }
        sessionsLinked++
      }

      await settleCoveredBookingPaymentSchedules(db, bookingId)

      return { paymentId: firstPaymentId, sessionsLinked }
    },
  }
}

export interface DispatchCheckoutFinalizeParams {
  db: PostgresJsDatabase
  eventBus: EventBus
  input: CheckoutFinalizeInput
  trigger: string
  correlationId: string | null
  tags: ReadonlyArray<string>
  parentRunId?: string | null
  triggeredByUserId?: string | null
  resumeFromStep?: string
  seedResults?: Record<string, unknown>
  generateContractPdf?: CatalogCheckoutContractPdfGenerator
}

function checkoutFinalizeInputRecord(input: CheckoutFinalizeInput): Record<string, unknown> {
  return { ...input }
}

/**
 * Run the checkout-finalize workflow for a booking: record a workflow run,
 * build the finalize deps (confirm booking, issue invoice, link payments,
 * generate contract PDF), execute `runCheckoutFinalize`, and mark the run
 * complete/failed. The deployment owns the db + event bus + (optional)
 * contract-pdf generator; this is the reusable saga driver.
 */
export async function dispatchCheckoutFinalize(
  params: DispatchCheckoutFinalizeParams,
): Promise<{ runId: string }> {
  const recorder = await beginWorkflowRun(params.db, {
    workflowName: "checkout-finalize",
    trigger: params.trigger,
    correlationId: params.correlationId ?? null,
    tags: [...params.tags],
    input: checkoutFinalizeInputRecord(params.input),
    parentRunId: params.parentRunId ?? null,
    triggeredByUserId: params.triggeredByUserId ?? null,
    resumeFromStep: params.resumeFromStep ?? null,
  })

  if (params.parentRunId) {
    try {
      const action = params.resumeFromStep ? "resumed" : "rerun"
      const description = params.resumeFromStep
        ? `Workflow checkout-finalize ${action} from step "${params.resumeFromStep}"`
        : `Workflow checkout-finalize ${action}`
      await params.db.insert(bookingActivityLog).values({
        bookingId: params.input.bookingId,
        actorId: params.triggeredByUserId ?? null,
        activityType: "system_action",
        description,
        metadata: {
          kind: "workflow_rerun",
          workflowName: "checkout-finalize",
          parentRunId: params.parentRunId,
          newRunId: recorder.runId,
          resumeFromStep: params.resumeFromStep ?? null,
        },
      })
    } catch (err) {
      console.warn("[catalog-checkout] failed to write rerun activity log", err)
    }
  }

  if (params.resumeFromStep && params.seedResults) {
    for (const [stepName, output] of Object.entries(params.seedResults)) {
      if (stepName === "__deps") continue
      await recorder.recordSkippedStep(
        stepName,
        output && typeof output === "object" ? (output as Record<string, unknown>) : null,
      )
    }
  }

  const deps = buildCheckoutFinalizeDeps(
    params.db,
    params.eventBus,
    recorder,
    params.generateContractPdf,
  )
  try {
    await runCheckoutFinalize(params.input, deps, {
      skipUntil: params.resumeFromStep,
      seedResults: params.seedResults,
    })
    await recorder.complete()
    return { runId: recorder.runId }
  } catch (err) {
    console.error("[catalog-checkout] checkout-finalize workflow failed", err)
    await recorder.fail(err)
    throw err
  }
}
