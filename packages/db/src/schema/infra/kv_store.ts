import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const infraKvStoreTable = pgTable(
  "kv_store",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("kv_store_expires_at_idx").on(table.expiresAt)],
).enableRLS()

export type InsertInfraKvStore = typeof infraKvStoreTable.$inferInsert
export type SelectInfraKvStore = typeof infraKvStoreTable.$inferSelect
