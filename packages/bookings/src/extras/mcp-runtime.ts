import type { ActionLedgerRequestContextValues } from "@voyant-travel/action-ledger"
import { executeAdmittedCreatedTargetCommand } from "@voyant-travel/action-ledger/created-command"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { ToolError, type ToolHandlerActionPolicyContext } from "@voyant-travel/tools"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { bookings } from "../schema.js"
import { bookingsExtrasService } from "./service.js"
import type { BookingsExtrasToolServices } from "./tools.js"

export function contributeBookingsExtrasToolContext(input: {
  request: unknown
  context: { db?: unknown }
}) {
  const db = input.context.db as PostgresJsDatabase
  const actorId = (input.request as Context).var.userId as string | undefined
  const request = input.request as Context
  const execute: BookingsExtrasToolServices["execute"] = async (
    operation,
    operationInput,
    admitted,
  ) => {
    const args = operationInput as Record<string, unknown>
    switch (operation) {
      case "listBookingExtras":
        return bookingsExtrasService.listBookingExtras(
          db,
          args as Parameters<typeof bookingsExtrasService.listBookingExtras>[1],
        )
      case "getBookingExtra":
        return bookingsExtrasService.getBookingExtraById(db, String(args.id))
      case "createBookingExtra":
        return executeBookingExtraCreate(
          request,
          db as unknown as AnyDrizzleDb,
          args,
          requiredAdmission(admitted),
        )
      case "updateBookingExtra": {
        const { id, ...data } = args
        return bookingsExtrasService.updateBookingExtra(
          db,
          String(id),
          data as Parameters<typeof bookingsExtrasService.updateBookingExtra>[2],
        )
      }
      case "getSlotExtraManifest": {
        const { slotId, ...query } = args
        return bookingsExtrasService.getSlotExtraManifest(
          db,
          String(slotId),
          query as Parameters<typeof bookingsExtrasService.getSlotExtraManifest>[2],
        )
      }
      case "setSlotExtraSelection": {
        const { slotId, ...data } = args
        return bookingsExtrasService.setSlotExtraSelection(
          db,
          String(slotId),
          data as Parameters<typeof bookingsExtrasService.setSlotExtraSelection>[2],
          actorId,
        )
      }
      case "bulkSetSlotExtraSelections": {
        const { slotId, ...data } = args
        return bookingsExtrasService.bulkSetSlotExtraSelections(
          db,
          String(slotId),
          data as Parameters<typeof bookingsExtrasService.bulkSetSlotExtraSelections>[2],
          actorId,
        )
      }
      case "bulkUpdateSlotExtraCollections": {
        const { slotId, ...data } = args
        return bookingsExtrasService.bulkUpdateSlotExtraCollections(
          db,
          String(slotId),
          data as Parameters<typeof bookingsExtrasService.bulkUpdateSlotExtraCollections>[2],
          actorId,
        )
      }
    }
  }
  return { bookingsExtras: { execute } }
}

async function executeBookingExtraCreate(
  c: Context,
  db: AnyDrizzleDb,
  input: Record<string, unknown>,
  admitted: ToolHandlerActionPolicyContext,
) {
  const idempotencyKey = String(input.idempotencyKey)
  const { idempotencyKey: _idempotencyKey, ...data } = input
  return (
    await executeAdmittedCreatedTargetCommand(
      {
        db,
        context: actionLedgerContext(c),
        admitted,
        idempotencyKey,
        commandTargetType: "booking-extra-create-command",
        canonicalTargetType: "booking-extra",
        resultReferenceType: "booking_extra",
        commandInput: input,
        evaluatedRisk: "medium",
      },
      {
        async create(tx) {
          const [parent] = await (tx as unknown as PostgresJsDatabase)
            .select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.id, String(data.bookingId)))
            .limit(1)
          if (!parent) {
            throw new ToolError("Booking extra parent booking was not found.", "INVALID_INPUT", {
              bookingId: data.bookingId,
            })
          }
          const row = await bookingsExtrasService.createBookingExtra(
            tx as unknown as PostgresJsDatabase,
            data as Parameters<typeof bookingsExtrasService.createBookingExtra>[1],
          )
          if (!row) throw new Error("Booking extra insert did not return a row")
          return { value: { id: row.id, replayed: false }, targetId: row.id }
        },
        async replay(_tx, completed) {
          return { id: completed.reference.id, replayed: true }
        },
      },
    )
  ).value
}

function requiredAdmission(
  admitted: ToolHandlerActionPolicyContext | undefined,
): ToolHandlerActionPolicyContext {
  if (admitted) return admitted
  throw new ToolError(
    "Handler-owned action policy context is required for booking-extra creation.",
    "ACTION_POLICY_REQUIRED",
  )
}

function actionLedgerContext(c: Context): ActionLedgerRequestContextValues {
  const vars = c.var as Record<string, unknown>
  return {
    userId: (vars.userId as string | undefined) ?? null,
    agentId: (vars.agentId as string | undefined) ?? null,
    workflowPrincipalId: (vars.workflowPrincipalId as string | undefined) ?? null,
    principalSubtype: (vars.principalSubtype as string | undefined) ?? null,
    sessionId: (vars.sessionId as string | undefined) ?? null,
    apiTokenId: ((vars.apiTokenId ?? vars.apiKeyId) as string | undefined) ?? null,
    callerType: (vars.callerType as ActionLedgerRequestContextValues["callerType"]) ?? null,
    actor: (vars.actor as ActionLedgerRequestContextValues["actor"]) ?? null,
    isInternalRequest: (vars.isInternalRequest as boolean | undefined) ?? false,
    organizationId: (vars.organizationId as string | undefined) ?? null,
    workflowRunId: (vars.workflowRunId as string | undefined) ?? null,
    workflowStepId: (vars.workflowStepId as string | undefined) ?? null,
    correlationId: c.req.header("x-correlation-id") ?? c.req.header("x-request-id") ?? null,
  }
}
