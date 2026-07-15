import { ToolError } from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { type BookingsInventoryRuntime, bookingsInventoryRuntimePort } from "../runtime-port.js"
import { bookingRequirementsService } from "./service.js"
import type { BookingRequirementsToolServices } from "./tools.js"

type ServiceFunction = (...args: never[]) => Promise<unknown>

export function contributeBookingRequirementsToolContext(input: {
  context: { db?: unknown }
  resources: Record<string, unknown>
}) {
  const db = input.context.db as PostgresJsDatabase
  const execute: BookingRequirementsToolServices["execute"] = async (operation, operationInput) => {
    const args = operationInput as Record<string, unknown>
    if (operation === "getPublicTransportRequirements") {
      const { productId, ...query } = args
      const inventory = await requiredInventoryRuntime(
        input.resources[bookingsInventoryRuntimePort.id],
      )
      return bookingRequirementsService.getPublicTransportRequirements(
        db,
        String(productId),
        query,
        inventory.resolveProductSnapshot,
      )
    }
    const candidate = Reflect.get(bookingRequirementsService, operation) as
      | ServiceFunction
      | undefined
    if (typeof candidate !== "function") {
      throw new ToolError(
        `Unsupported booking requirements operation: ${operation}`,
        "PROVIDER_ERROR",
      )
    }
    if (operation.startsWith("list") || operation.startsWith("create")) {
      return candidate(db as never, args as never)
    }
    if (operation.startsWith("get")) {
      return candidate(db as never, String(args.id) as never)
    }
    if (operation.startsWith("update")) {
      const { id, ...data } = args
      return candidate(db as never, String(id) as never, data as never)
    }
    throw new ToolError(
      `Unsupported booking requirements operation: ${operation}`,
      "PROVIDER_ERROR",
    )
  }
  return { bookingRequirements: { execute } }
}

async function requiredInventoryRuntime(value: unknown): Promise<BookingsInventoryRuntime> {
  const resolved = await Promise.resolve(value)
  if (resolved === undefined) {
    throw new ToolError(
      "Booking requirements need the selected bookings.inventory.runtime port.",
      "MISSING_SERVICE",
      { service: bookingsInventoryRuntimePort.id },
    )
  }
  await bookingsInventoryRuntimePort.test(resolved as BookingsInventoryRuntime)
  return resolved as BookingsInventoryRuntime
}
