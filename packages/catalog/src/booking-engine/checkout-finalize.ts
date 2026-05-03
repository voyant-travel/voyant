/**
 * `checkoutFinalize` workflow — runs on `payment.completed` for
 * bookings created through the storefront's checkout-start path.
 *
 * Steps:
 *   1. transition_to_confirmed — flip the booking from
 *      `awaiting_payment` to `confirmed`, stamping `paidAt`. This
 *      emits `booking.confirmed` which fans out to:
 *        - legal's auto-generate-contract subscriber (if wired)
 *        - finance's auto-generate-invoice subscriber (Phase 5)
 *   2. issue_invoice — explicit fallback when finance auto-generation
 *      isn't wired. Idempotent — checks if an invoice already exists.
 *
 * Compensation: if `issue_invoice` fails after the booking is
 * already confirmed, we don't roll back to `awaiting_payment` — the
 * payment was real and the booking is real. Instead the workflow
 * leaves the booking in `confirmed` and rethrows so the workflow
 * runs view surfaces the failed step for ops.
 *
 * This is a thin adapter on top of `createWorkflow` from
 * `@voyantjs/core/workflows` — no durability, no event-await; the
 * caller subscribes to `payment.completed` and runs the workflow
 * inline. Phase 6 of the storefront-checkout-flow plan elaborates
 * with workflow-runs surfacing.
 */

import type { EventBus } from "@voyantjs/core"
import { createWorkflow, step } from "@voyantjs/core/workflows"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export interface CheckoutFinalizeInput {
  bookingId: string
  /** Optional payment metadata for audit logging. */
  paymentSessionId?: string
  paymentIntent?: "card" | "bank_transfer" | "hold" | "ticket_on_credit"
}

export interface CheckoutFinalizeDeps {
  db: PostgresJsDatabase
  eventBus?: EventBus
  /**
   * Confirms the booking — flips it from `awaiting_payment`/`on_hold`
   * to `confirmed`. Implementations should emit `booking.confirmed`
   * once the transaction commits so downstream subscribers fan out.
   */
  confirmBooking: (bookingId: string) => Promise<void>
  /**
   * Issues the final invoice for the booking. When `convertedFromInvoiceId`
   * is supplied (proforma → invoice path), implementations should
   * preserve the linkage. Returning `null` is treated as "skipped"
   * (e.g. invoice already issued) and not an error.
   */
  issueInvoice: (input: {
    bookingId: string
    convertedFromInvoiceId?: string | null
  }) => Promise<{ invoiceId: string } | null>
  /**
   * Look up an existing proforma for this booking so we can pass
   * its id into `issueInvoice` (for the conversion linkage). Return
   * `null` if there isn't one — the booking went through card or
   * inquiry rather than bank-transfer.
   */
  findProformaForBooking?: (bookingId: string) => Promise<{ invoiceId: string } | null>
}

export const checkoutFinalizeWorkflow = createWorkflow("checkout-finalize", [
  step<CheckoutFinalizeInput, void>("transition_to_confirmed").run(async (input, ctx) => {
    const deps = ctx.results.__deps as CheckoutFinalizeDeps | undefined
    if (!deps) throw new Error("checkout-finalize: deps not seeded into context")
    await deps.confirmBooking(input.bookingId)
  }),

  step<CheckoutFinalizeInput, { invoiceId: string } | null>("issue_invoice").run(
    async (input, ctx) => {
      const deps = ctx.results.__deps as CheckoutFinalizeDeps | undefined
      if (!deps) throw new Error("checkout-finalize: deps not seeded into context")
      const proforma = deps.findProformaForBooking
        ? await deps.findProformaForBooking(input.bookingId)
        : null
      return deps.issueInvoice({
        bookingId: input.bookingId,
        convertedFromInvoiceId: proforma?.invoiceId ?? null,
      })
    },
  ),
])

/**
 * Run the workflow with deps seeded. Wraps `checkoutFinalizeWorkflow.run`
 * with the dependency-injection plumbing — the workflow primitive
 * doesn't carry a "deps" concept on its own, so we pass them through
 * `ctx.results` keyed under `__deps`.
 */
export async function runCheckoutFinalize(
  input: CheckoutFinalizeInput,
  deps: CheckoutFinalizeDeps,
): Promise<void> {
  // Seed deps into ctx.results before the first step runs by passing
  // them as a synthetic step output. This is a pragmatic shim — a
  // future workflow-engine extension may take a "context" param
  // directly.
  const seeded = createWorkflow("checkout-finalize", [
    step<CheckoutFinalizeInput, CheckoutFinalizeDeps>("__seed_deps").run(() => deps),
    ...checkoutFinalizeWorkflow.steps,
  ])
  await seeded.run({ input })
}
