import { bookingItems } from "@voyant-travel/bookings/schema"
import type { PaymentPolicy, PaymentPolicyEntityContext } from "@voyant-travel/finance"
import { and, asc, eq, isNotNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { ratePlans, stayBookingItems } from "./schema.js"

export async function resolveAccommodationBookingPaymentPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [row] = await db
    .select({ policy: ratePlans.customerPaymentPolicy })
    .from(stayBookingItems)
    .innerJoin(bookingItems, eq(bookingItems.id, stayBookingItems.bookingItemId))
    .innerJoin(ratePlans, eq(ratePlans.id, stayBookingItems.ratePlanId))
    .where(and(eq(bookingItems.bookingId, bookingId), isNotNull(ratePlans.customerPaymentPolicy)))
    .orderBy(asc(stayBookingItems.createdAt))
    .limit(1)
  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}

export async function resolveAccommodationEntityPaymentPolicy(
  db: PostgresJsDatabase,
  context: PaymentPolicyEntityContext,
): Promise<PaymentPolicy | null> {
  if (context.entityModule !== "accommodations" || !context.ratePlanId) return null
  const [row] = await db
    .select({ policy: ratePlans.customerPaymentPolicy })
    .from(ratePlans)
    .where(eq(ratePlans.id, context.ratePlanId))
    .limit(1)
  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}
