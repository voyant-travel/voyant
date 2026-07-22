import type { AnyDrizzleDb } from "@voyant-travel/db"
import { properties } from "@voyant-travel/operations"
import { eq } from "drizzle-orm"

import { products } from "./schema-core.js"

export async function listProductsReferencingAccommodationProperty(
  db: AnyDrizzleDb,
  propertyId: string,
): Promise<Array<{ entityModule: "products"; entityId: string }>> {
  const propertyRows = await db
    .select({ facilityId: properties.facilityId })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1)
  const facilityId = propertyRows[0]?.facilityId
  if (!facilityId) return []

  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.facilityId, facilityId))
  return unique(rows.map((row) => row.id)).map((entityId) => ({
    entityModule: "products" as const,
    entityId,
  }))
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}
