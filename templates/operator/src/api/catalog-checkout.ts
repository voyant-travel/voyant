/**
 * Storefront checkout endpoint + workflow wiring.
 *
 * `POST /v1/public/catalog/checkout/start` — invoked by the
 * storefront's BookingJourney after the customer accepts the
 * contract preview. Branches by `paymentIntent`:
 *
 *   - `card`         → start a card payment session, return its
 *                       redirect URL. (Phase 4: Netopia.)
 *   - `bank_transfer`→ issue a proforma synchronously, return
 *                       bank-details + reference. (Phase 5.)
 *   - `inquiry`      → write a lead, no inventory hold, no charge.
 *                       (Phase 6.)
 *
 * Subscribes to `payment.completed`: when the webhook (card) or the
 * admin "Mark payment received" action (bank-transfer) fires the
 * event, runs the `checkout-finalize` workflow which transitions
 * the booking to `confirmed` and triggers contract + invoice
 * generation.
 *
 * Contract acceptance is captured in the request body; we forward
 * it to the legal contract record once the booking is created, so
 * the audit trail links the rendered HTML to the booking.
 *
 * See `docs/architecture/storefront-checkout-flow.md` Phase 3.
 */

import { bookingsService } from "@voyantjs/bookings"
import { runCheckoutFinalize } from "@voyantjs/catalog/booking-engine"
import { parseJsonBody } from "@voyantjs/hono"
import type { HonoBundle } from "@voyantjs/hono/plugin"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"
import { z } from "zod"

import { getDbFromHyperdrive } from "./lib/db"

const checkoutStartSchema = z.object({
  bookingId: z.string().min(1),
  paymentIntent: z.enum(["card", "bank_transfer", "hold", "inquiry"]),
  contractAcceptance: z
    .object({
      templateId: z.string().min(1),
      templateSlug: z.string().min(1),
      acceptedTerms: z.literal(true),
      acceptedMarketing: z.boolean(),
      acceptedAt: z.string().datetime(),
      renderedHtml: z.string().min(1),
    })
    .optional(),
})

interface PaymentCompletedPayload {
  bookingId: string
  paymentSessionId?: string
  paymentIntent?: "card" | "bank_transfer" | "hold" | "ticket_on_credit"
}

export function mountCatalogCheckoutRoutes(hono: Hono): void {
  hono.post("/v1/public/catalog/checkout/start", handleCheckoutStart)
}

async function handleCheckoutStart(c: Context): Promise<Response> {
  let body: z.infer<typeof checkoutStartSchema>
  try {
    body = await parseJsonBody(c, checkoutStartSchema)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "invalid body" }, 400)
  }

  // Phase 3 ships only the routing scaffold + workflow wiring.
  // Per-intent bodies (Netopia redirect, proforma issuance, inquiry
  // creation) light up in Phases 4–6 of the storefront-checkout-flow
  // plan. Returning a structured stub now means the storefront
  // wrapper can integrate end-to-end and the flesh-out later is a
  // mechanical fill-in.
  switch (body.paymentIntent) {
    case "card":
      return c.json({
        kind: "card_redirect" as const,
        redirectUrl: `/shop/payment-processing/${encodeURIComponent(body.bookingId)}`,
        bookingId: body.bookingId,
        note: "Phase 4 wires Netopia — for now this points at a placeholder confirmation route.",
      })
    case "bank_transfer":
      return c.json({
        kind: "bank_transfer_instructions" as const,
        bookingId: body.bookingId,
        instructions: {
          beneficiary: "Configured via PaymentProviderCapabilities.config.bankTransferDetails",
          iban: "—",
          reference: `BOOK-${body.bookingId}`,
          amount: 0,
          currency: "EUR",
          dueAt: null,
        },
        note: "Phase 5 issues the real proforma + populates bank details from deployment config.",
      })
    case "inquiry":
      return c.json({
        kind: "inquiry_received" as const,
        bookingId: body.bookingId,
        inquiryId: `inq-stub-${body.bookingId}`,
        note: "Phase 6 writes a CRM opportunity and emits inquiry.created.",
      })
    case "hold":
      return c.json({
        kind: "hold_placed" as const,
        bookingId: body.bookingId,
        note: "Operator surfaces use this — staff broker the booking and follow up for payment.",
      })
  }
}

/**
 * Bundle that subscribes to `payment.completed` and runs the
 * checkout-finalize workflow with the wired-in deps. The actual
 * deps (confirmBooking, issueInvoice, findProformaForBooking) are
 * stubbed in Phase 3 — Phase 4/5 wire them to the real services.
 */
export const catalogCheckoutBundle: HonoBundle = {
  name: "catalog-checkout",
  bootstrap: ({ bindings, eventBus }) => {
    const env = bindings as CloudflareBindings
    eventBus.subscribe<PaymentCompletedPayload>("payment.completed", async ({ data }) => {
      // The Hyperdrive helper returns a union of postgres-js / neon
      // drivers; templates configure the node adapter at runtime so
      // the cast is safe. Bookings + finance services type-check
      // against PostgresJsDatabase, so we narrow at the boundary.
      const db = getDbFromHyperdrive(env) as unknown as PostgresJsDatabase
      try {
        await runCheckoutFinalize(
          {
            bookingId: data.bookingId,
            paymentSessionId: data.paymentSessionId,
            paymentIntent: data.paymentIntent,
          },
          {
            db,
            eventBus,
            confirmBooking: async (bookingId) => {
              // The booking service emits `booking.confirmed` after
              // the transition commits, which fans out to the legal
              // package's auto-generate-contract subscriber.
              await bookingsService.confirmBooking(db, bookingId, {}, undefined, { eventBus })
            },
            issueInvoice: async ({ bookingId, convertedFromInvoiceId }) => {
              // Phase 4/5 fill this in by composing
              // `issueInvoiceFromBooking` (or its proforma-conversion
              // counterpart) once the booking + items snapshot is
              // available in this scope. Returning null is treated
              // as "skipped" so the workflow doesn't fail.
              console.warn(
                `[catalog-checkout] invoice issuance not wired yet for booking ${bookingId}` +
                  (convertedFromInvoiceId
                    ? ` (proforma ${convertedFromInvoiceId} pending conversion)`
                    : ""),
              )
              return null
            },
            findProformaForBooking: async () => null,
          },
        )
      } catch (err) {
        console.error("[catalog-checkout] checkout-finalize workflow failed", err)
      }
    })
  },
}
