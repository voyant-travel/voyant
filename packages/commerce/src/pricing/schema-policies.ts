import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { cancellationChargeTypeEnum, cancellationPolicyTypeEnum } from "./schema-shared.js"

export const cancellationPolicies = pgTable(
  "cancellation_policies",
  {
    id: typeId("cancellation_policies"),
    code: text("code"),
    name: text("name").notNull(),
    policyType: cancellationPolicyTypeEnum("policy_type").notNull().default("custom"),
    simpleCutoffHours: integer("simple_cutoff_hours"),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_cancellation_policies_updated").on(table.updatedAt),
    index("idx_cancellation_policies_type_updated").on(table.policyType, table.updatedAt),
    index("idx_cancellation_policies_active_updated").on(table.active, table.updatedAt),
    index("idx_cancellation_policies_default_updated").on(table.isDefault, table.updatedAt),
    uniqueIndex("uidx_cancellation_policies_code").on(table.code),
  ],
)

export const cancellationPolicyRules = pgTable(
  "cancellation_policy_rules",
  {
    id: typeId("cancellation_policy_rules"),
    cancellationPolicyId: typeIdRef("cancellation_policy_id")
      .notNull()
      .references(() => cancellationPolicies.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    cutoffMinutesBefore: integer("cutoff_minutes_before"),
    chargeType: cancellationChargeTypeEnum("charge_type").notNull().default("none"),
    chargeAmountCents: integer("charge_amount_cents"),
    chargePercentBasisPoints: integer("charge_percent_basis_points"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_cancellation_policy_rules_created").on(table.createdAt),
    index("idx_cancellation_policy_rules_policy_sort_created").on(
      table.cancellationPolicyId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_cancellation_policy_rules_active_sort_created").on(
      table.active,
      table.sortOrder,
      table.createdAt,
    ),
  ],
)

export type CancellationPolicy = typeof cancellationPolicies.$inferSelect
export type NewCancellationPolicy = typeof cancellationPolicies.$inferInsert
export type CancellationPolicyRule = typeof cancellationPolicyRules.$inferSelect
export type NewCancellationPolicyRule = typeof cancellationPolicyRules.$inferInsert
