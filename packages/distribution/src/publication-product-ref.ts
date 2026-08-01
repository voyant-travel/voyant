import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const publicationProductsRef = pgTable("products", {
  id: typeId("products").primaryKey(),
  supplierId: typeIdRef("supplier_id"),
  status: text("status"),
  visibility: text("visibility"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
})
