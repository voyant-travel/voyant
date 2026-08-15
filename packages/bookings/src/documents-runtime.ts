/**
 * Tool-context contribution for the Booking Document Tools.
 *
 * Thin over `bookingsService`: it resolves the booking, records the document,
 * and writes the action-ledger entry that says who recorded it. It deliberately
 * reaches for no invoice series, no contract series, and no renderer — see
 * `tools-documents.ts` for why recording is not issuing (voyant#4657).
 */

import { appendActionLedgerMutation } from "@voyant-travel/action-ledger"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import {
  BOOKING_DOCUMENT_LEDGER_ACTION_NAME,
  BOOKING_DOCUMENT_LEDGER_ACTION_VERSION,
} from "./action-declarations.js"
import { type Env, getActionLedgerRequestContext } from "./routes-shared.js"
import type { BookingDocument } from "./schema.js"
import { bookingsService } from "./service.js"
import type { BookingDocumentsToolServices } from "./tools-documents.js"

function toWire(row: BookingDocument) {
  return {
    id: row.id,
    bookingId: row.bookingId,
    travelerId: row.travelerId ?? null,
    type: row.type,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    issuedBy: row.issuedBy ?? null,
    issuedSeries: row.issuedSeries ?? null,
    issuedNumber: row.issuedNumber ?? null,
    issuedAt: row.issuedAt ? row.issuedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export function contributeBookingDocumentsToolContext(input: {
  request: unknown
  context: { db?: unknown }
}): { bookingDocuments: BookingDocumentsToolServices } {
  const c = input.request as Context<Env>
  const db = input.context.db as PostgresJsDatabase

  return {
    bookingDocuments: {
      async listBookingDocuments({ bookingId }) {
        const booking = await bookingsService.getBookingById(db, bookingId)
        if (!booking) return null
        const rows = await bookingsService.listDocuments(db, bookingId)
        return { data: rows.map(toWire) }
      },
      async recordBookingDocument(command) {
        const { bookingId, ...data } = command
        const result = await bookingsService.createDocument(db, bookingId, {
          ...data,
          travelerId: data.travelerId ?? null,
        })
        if (!result) return null

        // Only the recording that actually happened is an event; a replay of a
        // document already on the booking changed nothing and must not read as
        // a second recording in the audit trail.
        if (!result.replayed) {
          await appendActionLedgerMutation(db as AnyDrizzleDb, {
            context: getActionLedgerRequestContext(c),
            actionName: BOOKING_DOCUMENT_LEDGER_ACTION_NAME,
            actionVersion: BOOKING_DOCUMENT_LEDGER_ACTION_VERSION,
            actionKind: "create",
            evaluatedRisk: "medium",
            targetType: "booking",
            targetId: bookingId,
            routeOrToolName: "record_booking_document",
            authorizationSource: "bookings.tool",
            mutationDetail: {
              summary: describeRecording(result.document),
              reversalKind: "none",
            },
          })
        }

        return { document: toWire(result.document), replayed: result.replayed }
      },
    },
  }
}

function describeRecording(document: BookingDocument): string {
  const identity = [document.issuedSeries, document.issuedNumber].filter(Boolean).join(" ")
  return identity
    ? `Recorded externally issued ${document.type} ${identity}`
    : `Recorded ${document.type} document`
}
