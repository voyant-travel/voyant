import { RequestValidationError } from "@voyant-travel/hono"
import { and, eq, ne } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { productDays } from "./schema.js"

export function itineraryDayNumberValidationError() {
  return new RequestValidationError("dayNumber must be unique within itinerary", {
    issues: [{ path: ["dayNumber"], message: "dayNumber must be unique within itinerary" }],
  })
}

function readErrorField(err: unknown, field: string): unknown {
  if (!err || typeof err !== "object") return undefined
  return (err as Record<string, unknown>)[field]
}

function isUniqueItineraryDayNumberError(err: unknown): boolean {
  const code = readErrorField(err, "code")
  const details = [
    readErrorField(err, "constraint"),
    readErrorField(err, "constraintName"),
    readErrorField(err, "constraint_name"),
    readErrorField(err, "message"),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")

  if (code === "23505" && details.includes("uidx_product_days_itinerary_day_number")) {
    return true
  }

  const cause = readErrorField(err, "cause")
  return cause ? isUniqueItineraryDayNumberError(cause) : false
}

export function mapItineraryDayNumberWriteError(err: unknown): never {
  if (isUniqueItineraryDayNumberError(err)) {
    throw itineraryDayNumberValidationError()
  }

  throw err
}

export async function assertItineraryDayNumberAvailable(
  db: PostgresJsDatabase,
  itineraryId: string,
  dayNumber: number,
  exceptDayId?: string,
) {
  const [conflict] = await db
    .select({ id: productDays.id })
    .from(productDays)
    .where(
      and(
        eq(productDays.itineraryId, itineraryId),
        eq(productDays.dayNumber, dayNumber),
        exceptDayId ? ne(productDays.id, exceptDayId) : undefined,
      ),
    )
    .limit(1)

  if (conflict) {
    throw itineraryDayNumberValidationError()
  }
}
