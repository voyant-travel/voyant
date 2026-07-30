/**
 * Finance's provider for `bookings.self-service-create.runtime`.
 *
 * Bookings owns the `/v1/public/bookings` resource; Finance owns the durable
 * command that composes a booking with its payment schedules, tax lines, and
 * documents. Finance depends on Bookings and not the reverse, so the command
 * reaches the route through this port rather than the route reaching into
 * Finance.
 *
 * Everything in the command is derived server-side. The caller named a draft
 * and a quote; it never names a booking number, price, tax line, relationship
 * id, or status.
 */
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { executeFinanceSelfServiceBookingCreateCommand } from "./booking-create-command.js"
import { FINANCE_BOOKING_CREATE_SELF_SERVICE_ACTION } from "./booking-create-policy.js"
import { allocateBookingNumber } from "./booking-number.js"
import type { SelfServiceBookingSourceRuntime } from "./self-service-booking-source.js"
import type { FinanceServiceRuntime } from "./service.js"

export interface SelfServiceCreateRuntimeDeps {
  /** Resolves and verifies the public draft + quote, and spends them. */
  source: SelfServiceBookingSourceRuntime
  /**
   * Mints the route admission against the graph-registered action. The route
   * never fabricates one; this is the only way it can be obtained.
   */
  admit(
    actor: string,
    idempotencyKey: string,
  ): Parameters<typeof executeFinanceSelfServiceBookingCreateCommand>[0]["admitted"]
  runtime?: FinanceServiceRuntime
}

export function createSelfServiceCreateRuntime(deps: SelfServiceCreateRuntimeDeps) {
  return {
    async createFromDraft(input: {
      db: PostgresJsDatabase
      draftId: string
      quoteId: string
      caller: { personId?: string; verifiedEmail?: string; verifiedPhone?: string }
      idempotencyKey: string
      fallbackPrincipalId: string
      sessionId?: string
      consumeSources?(tx: PostgresJsDatabase, bookingId: string): Promise<void>
    }) {
      const resolved = await deps.source.resolveBookingSource({
        db: input.db,
        draftId: input.draftId,
        quoteId: input.quoteId,
        caller: input.caller,
      })
      if (resolved.status !== "ok") {
        return { status: "rejected" as const, reason: resolved.reason }
      }

      // Allocated here, never accepted from the caller.
      const bookingNumber = await allocateBookingNumber(input.db)

      const result = await executeFinanceSelfServiceBookingCreateCommand({
        db: input.db,
        context: {
          actor: "customer",
          callerType: "session",
          principalSubtype: "verified_guest",
          ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        },
        fallbackPrincipalId: input.fallbackPrincipalId,
        commandInput: { ...resolved.command, bookingNumber } as never,
        admitted: deps.admit("customer", input.idempotencyKey),
        ...(deps.runtime ? { runtime: deps.runtime } : {}),
        async consumeSources(tx, bookingId) {
          await deps.source.consumeBookingSource(tx, {
            draftId: input.draftId,
            quoteId: input.quoteId,
            bookingId,
          })
          await input.consumeSources?.(tx, bookingId)
        },
      })

      return {
        status: "ok" as const,
        bookingId: result.value.bookingId,
        bookingNumber,
      }
    },
  }
}

export { FINANCE_BOOKING_CREATE_SELF_SERVICE_ACTION }
