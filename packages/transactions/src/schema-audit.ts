import { typeId } from "@voyantjs/db/lib/typeid-column"
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { transactionPiiAccessActionEnum, transactionPiiAccessOutcomeEnum } from "./schema-shared.js"

export const transactionPiiAccessLog = pgTable(
  "transaction_pii_access_log",
  {
    id: typeId("transaction_pii_access_log"),
    travelerKind: text("traveler_kind").notNull(),
    parentId: text("parent_id"),
    travelerId: text("traveler_id"),
    actorId: text("actor_id"),
    actorType: text("actor_type"),
    callerType: text("caller_type"),
    action: transactionPiiAccessActionEnum("action").notNull(),
    outcome: transactionPiiAccessOutcomeEnum("outcome").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_transaction_pii_access_log_parent").on(table.parentId),
    index("idx_transaction_pii_access_log_participant").on(table.travelerId),
    index("idx_transaction_pii_access_log_actor").on(table.actorId),
    index("idx_transaction_pii_access_log_created_at").on(table.createdAt),
  ],
)

export type TransactionPiiAccessLog = typeof transactionPiiAccessLog.$inferSelect
export type NewTransactionPiiAccessLog = typeof transactionPiiAccessLog.$inferInsert
