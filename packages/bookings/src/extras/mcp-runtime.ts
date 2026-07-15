import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import { bookingsExtrasService } from "./service.js"
import type { BookingsExtrasToolServices } from "./tools.js"

export function contributeBookingsExtrasToolContext(input: {
  request: unknown
  context: { db?: unknown }
}) {
  const db = input.context.db as PostgresJsDatabase
  const actorId = (input.request as Context).var.userId as string | undefined
  const execute: BookingsExtrasToolServices["execute"] = async (operation, operationInput) => {
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
        return bookingsExtrasService.createBookingExtra(
          db,
          args as Parameters<typeof bookingsExtrasService.createBookingExtra>[1],
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
