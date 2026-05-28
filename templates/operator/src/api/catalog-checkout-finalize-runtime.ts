import { bookingsService } from "@voyantjs/bookings"
import { bookingActivityLog, bookings } from "@voyantjs/bookings/schema"
import {
  type CheckoutFinalizeDeps,
  type CheckoutFinalizeInput,
  runCheckoutFinalize,
} from "@voyantjs/catalog/booking-engine"
import type { EventBus } from "@voyantjs/core"
import { issueInvoiceFromBooking } from "@voyantjs/finance"
import type { HonoBundle } from "@voyantjs/hono/plugin"
import {
  beginWorkflowRun,
  type WorkflowRunnerRegistry,
  type WorkflowRunRecorder,
} from "@voyantjs/workflow-runs"
import { and, eq, isNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { persistAcceptanceSignature } from "./catalog-checkout-acceptance-signature"
import { withDbFromEnv } from "./lib/db"
import { operatorBindings, operatorPostgresDb } from "./operator-runtime-adapter"

interface PaymentCompletedPayload {
  bookingId: string | null
  paymentSessionId?: string
  paymentIntent?: "card" | "bank_transfer" | "hold" | "ticket_on_credit"
  amountCents?: number
  currency?: string
  provider?: string | null
}

interface ContractDocumentGeneratedPayload {
  contractId: string
  contractStatus: string
  attachmentId: string
  attachmentKind: string
  attachmentName: string
}

/**
 * Optional callback that generates (or fetches existing) the contract PDF for
 * a booking. Wired by app.ts and forwarded into the explicit
 * `generate_contract_pdf` workflow step.
 */
export type CatalogCheckoutContractPdfGenerator = (input: {
  env: CloudflareBindings
  db: PostgresJsDatabase
  eventBus: EventBus
  bookingId: string
}) => Promise<{ contractId: string; attachmentId: string } | null>

function buildCheckoutFinalizeDeps(
  env: CloudflareBindings,
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
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
      if (!booking) return null

      const { bookingItems } = await import("@voyantjs/bookings/schema")
      const items = await db
        .select()
        .from(bookingItems)
        .where(eq(bookingItems.bookingId, bookingId))

      const today = new Date().toISOString().slice(0, 10)
      const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      const invoice = await issueInvoiceFromBooking(
        db,
        {
          bookingId,
          issueDate: today,
          dueDate,
          invoiceType: "invoice",
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

      if (invoice && convertedFromInvoiceId) {
        const { invoices } = await import("@voyantjs/finance")
        await db.update(invoices).set({ convertedFromInvoiceId }).where(eq(invoices.id, invoice.id))
      }

      return invoice ? { invoiceId: invoice.id } : null
    },
    findProformaForBooking: async (bookingId) => {
      const { invoices } = await import("@voyantjs/finance")
      const [proforma] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.bookingId, bookingId))
        .limit(1)
      return proforma ? { invoiceId: proforma.id } : null
    },
    generateContractPdf: generateContractPdf
      ? async ({ bookingId }) => generateContractPdf({ env, db, eventBus, bookingId })
      : undefined,
    linkPaymentToInvoice: async ({ bookingId, invoiceId, paymentSessionId }) => {
      const { paymentSessions } = await import("@voyantjs/finance/schema")
      const { financeService } = await import("@voyantjs/finance")
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

      return { paymentId: firstPaymentId, sessionsLinked }
    },
  }
}

interface DispatchCheckoutFinalizeParams {
  env: CloudflareBindings
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

async function dispatchCheckoutFinalize(
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
    params.env,
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

/**
 * Bundle factory that subscribes to checkout-finalize events and registers
 * workflow-runs rerun/resume handlers for the standalone dashboard.
 */
export function createCatalogCheckoutBundle(opts: {
  workflowRunnerRegistry?: WorkflowRunnerRegistry
  generateContractPdf?: CatalogCheckoutContractPdfGenerator
}): HonoBundle {
  return {
    name: "catalog-checkout",
    bootstrap: ({ bindings, eventBus }) => {
      const env = operatorBindings(bindings)
      eventBus.subscribe<ContractDocumentGeneratedPayload>(
        "contract.document.generated",
        async ({ data }) => {
          try {
            await withDbFromEnv(env, async (rawDb) => {
              await persistAcceptanceSignature(operatorPostgresDb(rawDb), data.contractId, eventBus)
            })
          } catch (err) {
            console.error("[catalog-checkout] persistAcceptanceSignature failed", err)
          }
        },
      )
      eventBus.subscribe<PaymentCompletedPayload>("payment.completed", async ({ data }) => {
        if (!data.bookingId) return
        const bookingId = data.bookingId
        try {
          await withDbFromEnv(env, async (rawDb) => {
            await dispatchCheckoutFinalize({
              env,
              db: operatorPostgresDb(rawDb),
              eventBus,
              input: {
                bookingId,
                paymentSessionId: data.paymentSessionId,
                paymentIntent: data.paymentIntent,
              },
              trigger: "payment.completed",
              correlationId: data.paymentSessionId ?? null,
              tags: [
                `bookingId:${bookingId}`,
                ...(data.paymentSessionId ? [`paymentSessionId:${data.paymentSessionId}`] : []),
                ...(data.paymentIntent ? [`paymentIntent:${data.paymentIntent}`] : []),
              ],
              generateContractPdf: opts.generateContractPdf,
            })
          })
        } catch {
          // dispatchCheckoutFinalize already logged + recorded the
          // failure; swallow here so the event-bus callback doesn't
          // bubble to the dispatch caller.
        }
      })

      if (opts.workflowRunnerRegistry) {
        opts.workflowRunnerRegistry.register({
          name: "checkout-finalize",
          idempotency: "unsafe",
          description:
            "Confirms the booking and issues the final invoice. A fresh rerun issues another invoice number; use Resume to retry from a failed step.",
          rerun: async (rawInput, ctx) => {
            const input = rawInput as CheckoutFinalizeInput | null
            if (!input?.bookingId) {
              throw new Error("checkout-finalize rerun: recorded input has no bookingId")
            }
            return withDbFromEnv(env, async (rawDb) =>
              dispatchCheckoutFinalize({
                env,
                db: operatorPostgresDb(rawDb),
                eventBus,
                input,
                trigger: "manual.rerun",
                correlationId: ctx.correlationId,
                tags: [...ctx.tags, "rerun:true"],
                parentRunId: ctx.parentRunId,
                triggeredByUserId: ctx.triggeredByUserId,
                generateContractPdf: opts.generateContractPdf,
              }),
            )
          },
          resume: async (rawInput, ctx) => {
            const input = rawInput as CheckoutFinalizeInput | null
            if (!input?.bookingId) {
              throw new Error("checkout-finalize resume: recorded input has no bookingId")
            }
            return withDbFromEnv(env, async (rawDb) =>
              dispatchCheckoutFinalize({
                env,
                db: operatorPostgresDb(rawDb),
                eventBus,
                input,
                trigger: "manual.resume",
                correlationId: ctx.correlationId,
                tags: [...ctx.tags, "resume:true"],
                parentRunId: ctx.parentRunId,
                triggeredByUserId: ctx.triggeredByUserId,
                resumeFromStep: ctx.resumeFromStep,
                seedResults: ctx.seedResults,
                generateContractPdf: opts.generateContractPdf,
              }),
            )
          },
        })
      }
    },
  }
}

/** @deprecated Kept for callers that still import the static bundle. */
export const catalogCheckoutBundle = createCatalogCheckoutBundle({})
