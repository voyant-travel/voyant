import { bookingSupplierStatuses } from "@voyant-travel/bookings/schema"
import type { PaymentPolicy } from "@voyant-travel/finance"
import { asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { supplierServices, suppliers } from "./schema.js"

export async function resolveBookingSupplierPaymentPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [row] = await db
    .select({ policy: suppliers.customerPaymentPolicy })
    .from(bookingSupplierStatuses)
    .innerJoin(supplierServices, eq(supplierServices.id, bookingSupplierStatuses.supplierServiceId))
    .innerJoin(suppliers, eq(suppliers.id, supplierServices.supplierId))
    .where(eq(bookingSupplierStatuses.bookingId, bookingId))
    .orderBy(asc(bookingSupplierStatuses.createdAt))
    .limit(1)
  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}

export async function resolveSupplierPaymentPolicyById(
  db: PostgresJsDatabase,
  supplierId: string,
): Promise<PaymentPolicy | null> {
  const [row] = await db
    .select({ policy: suppliers.customerPaymentPolicy })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1)
  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}
