import { pgTable, text } from "drizzle-orm/pg-core"

/** Minimal reference to the products table for LEFT JOIN enrichment. */
export const productsRef = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
})
