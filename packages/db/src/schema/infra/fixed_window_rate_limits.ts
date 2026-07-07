import { bigint, index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

export const infraFixedWindowRateLimitsTable = pgTable(
  "fixed_window_rate_limits",
  {
    key: text("key").notNull(),
    window: bigint("window", { mode: "number" }).notNull(),
    count: integer("count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.window] }),
    index("fixed_window_rate_limits_expires_at_idx").on(table.expiresAt),
  ],
).enableRLS()

export type InsertInfraFixedWindowRateLimit = typeof infraFixedWindowRateLimitsTable.$inferInsert
export type SelectInfraFixedWindowRateLimit = typeof infraFixedWindowRateLimitsTable.$inferSelect
