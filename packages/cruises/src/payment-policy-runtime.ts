import type { PaymentPolicy, PaymentPolicyEntityContext } from "@voyant-travel/finance"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { bookingCruiseDetails } from "./booking-extension.js"
import { cruiseCabinCategories, cruiseSailings, cruises } from "./schema.js"

export async function resolveCruiseBookingPaymentPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [details] = await db
    .select({
      sailingId: bookingCruiseDetails.sailingId,
      cabinCategoryId: bookingCruiseDetails.cabinCategoryId,
    })
    .from(bookingCruiseDetails)
    .where(eq(bookingCruiseDetails.bookingId, bookingId))
    .limit(1)
  if (!details) return null

  if (details.cabinCategoryId) {
    const [cabin] = await db
      .select({ policy: cruiseCabinCategories.customerPaymentPolicy })
      .from(cruiseCabinCategories)
      .where(eq(cruiseCabinCategories.id, details.cabinCategoryId))
      .limit(1)
    const policy = (cabin?.policy as PaymentPolicy | null | undefined) ?? null
    if (policy) return policy
  }
  if (!details.sailingId) return null

  const [sailing] = await db
    .select({ policy: cruiseSailings.customerPaymentPolicy, cruiseId: cruiseSailings.cruiseId })
    .from(cruiseSailings)
    .where(eq(cruiseSailings.id, details.sailingId))
    .limit(1)
  const sailingPolicy = (sailing?.policy as PaymentPolicy | null | undefined) ?? null
  if (sailingPolicy || !sailing?.cruiseId) return sailingPolicy
  const [cruise] = await db
    .select({ policy: cruises.customerPaymentPolicy })
    .from(cruises)
    .where(eq(cruises.id, sailing.cruiseId))
    .limit(1)
  return (cruise?.policy as PaymentPolicy | null | undefined) ?? null
}

export async function resolveCruiseEntityPaymentPolicy(
  db: PostgresJsDatabase,
  context: PaymentPolicyEntityContext,
): Promise<PaymentPolicy | null> {
  if (context.entityModule !== "cruises") return null
  if (context.cabinCategoryId) {
    const [row] = await db
      .select({ policy: cruiseCabinCategories.customerPaymentPolicy })
      .from(cruiseCabinCategories)
      .where(eq(cruiseCabinCategories.id, context.cabinCategoryId))
      .limit(1)
    const policy = (row?.policy as PaymentPolicy | null | undefined) ?? null
    if (policy) return policy
  }
  if (context.sailingId) {
    const [row] = await db
      .select({ policy: cruiseSailings.customerPaymentPolicy })
      .from(cruiseSailings)
      .where(eq(cruiseSailings.id, context.sailingId))
      .limit(1)
    const policy = (row?.policy as PaymentPolicy | null | undefined) ?? null
    if (policy) return policy
  }
  const [row] = await db
    .select({ policy: cruises.customerPaymentPolicy })
    .from(cruises)
    .where(eq(cruises.id, context.entityId))
    .limit(1)
  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}

export async function resolveCruiseSupplierId(
  db: PostgresJsDatabase,
  context: PaymentPolicyEntityContext,
): Promise<string | null> {
  if (context.entityModule !== "cruises") return null
  const [row] = await db
    .select({ supplierId: cruises.lineSupplierId })
    .from(cruises)
    .where(eq(cruises.id, context.entityId))
    .limit(1)
  return row?.supplierId ?? null
}
