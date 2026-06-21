import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core"

/** Minimal reference to the products table for LEFT JOIN enrichment. */
export const productsRef = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
})

/** Minimal reference to product_options for validating explicit slot option links. */
export const productOptionsRef = pgTable("product_options", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  isDefault: boolean("is_default").notNull(),
  sortOrder: integer("sort_order").notNull(),
})
