import type { EventBus } from "@voyantjs/core"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { invoices } from "./schema.js"
import {
  type CreateInvoiceFromBookingInput,
  financeService,
  type InvoiceFromBookingData,
} from "./service.js"

/**
 * Issue / proforma orchestration helpers that wrap the bare invoice
 * creators with EventBus emissions so subscribers (SmartBill plugin,
 * checkout-finalize workflow) can react.
 *
 * `createInvoice*` services in `service.ts` stay pure DB writers —
 * the workflow / route layer chooses when to mark them as "issued"
 * (a status change that's also a system signal).
 */

export interface InvoiceIssueRuntime {
  eventBus?: EventBus
}

export interface InvoiceIssuedEvent {
  invoiceId: string
  invoiceNumber: string
  invoiceType: "invoice" | "proforma" | "credit_note"
  bookingId: string | null
  totalCents: number
  currency: string
  /** Linkage when this invoice replaced a proforma. */
  convertedFromInvoiceId?: string | null
}

const ISSUED_EVENT = "invoice.issued"
const PROFORMA_ISSUED_EVENT = "invoice.proforma.issued"

/**
 * Create + emit an invoice from a booking. Returns the persisted row
 * after flipping the status from `draft` → `sent`. The status flip is
 * what consumers treat as "issued" — drafts shouldn't trigger
 * SmartBill sync.
 */
export async function issueInvoiceFromBooking(
  db: PostgresJsDatabase,
  input: CreateInvoiceFromBookingInput,
  bookingData: InvoiceFromBookingData,
  runtime: InvoiceIssueRuntime = {},
) {
  const draft = await financeService.createInvoiceFromBooking(db, input, bookingData)
  if (!draft) return null

  const [issued] = await db
    .update(invoices)
    .set({ status: "sent", updatedAt: new Date() })
    .where(eq(invoices.id, draft.id))
    .returning()

  const row = issued ?? draft
  await emitIssued(runtime, ISSUED_EVENT, row)
  return row
}

/**
 * Create + emit a proforma from a booking. Same shape as
 * `issueInvoiceFromBooking` but marks the row as `invoiceType:
 * 'proforma'` and emits the proforma-specific event so the
 * SmartBill plugin can route to its proforma endpoint.
 */
export async function issueProformaFromBooking(
  db: PostgresJsDatabase,
  input: CreateInvoiceFromBookingInput,
  bookingData: InvoiceFromBookingData,
  runtime: InvoiceIssueRuntime = {},
) {
  const draft = await financeService.createInvoiceFromBooking(db, input, bookingData)
  if (!draft) return null

  const [issued] = await db
    .update(invoices)
    .set({ invoiceType: "proforma", status: "sent", updatedAt: new Date() })
    .where(eq(invoices.id, draft.id))
    .returning()

  const row = issued ?? draft
  await emitIssued(runtime, PROFORMA_ISSUED_EVENT, row)
  return row
}

async function emitIssued(
  runtime: InvoiceIssueRuntime,
  eventName: typeof ISSUED_EVENT | typeof PROFORMA_ISSUED_EVENT,
  invoice: typeof invoices.$inferSelect,
): Promise<void> {
  if (!runtime.eventBus) return
  const payload: InvoiceIssuedEvent = {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceType: invoice.invoiceType,
    bookingId: invoice.bookingId,
    totalCents: invoice.totalCents,
    currency: invoice.currency,
    convertedFromInvoiceId: invoice.convertedFromInvoiceId,
  }
  await runtime.eventBus.emit(eventName, payload)
}
