import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { boolean, date, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { channelContracts, channels } from "./schema-core.js"
import {
  channelAllotmentReleaseModeEnum,
  channelAllotmentUnsoldActionEnum,
  channelReleaseExecutionActionEnum,
  channelReleaseExecutionStatusEnum,
} from "./schema-shared.js"

export const channelInventoryAllotments = pgTable(
  "channel_inventory_allotments",
  {
    id: typeId("channel_inventory_allotments"),
    channelId: typeIdRef("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    contractId: typeIdRef("contract_id").references(() => channelContracts.id, {
      onDelete: "set null",
    }),
    productId: typeIdRef("product_id").notNull(),
    optionId: typeIdRef("option_id"),
    startTimeId: typeIdRef("start_time_id"),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    guaranteedCapacity: integer("guaranteed_capacity"),
    maxCapacity: integer("max_capacity"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_channel_inventory_allotments_updated").on(table.updatedAt),
    index("idx_channel_inventory_allotments_channel_updated").on(table.channelId, table.updatedAt),
    index("idx_channel_inventory_allotments_contract_updated").on(
      table.contractId,
      table.updatedAt,
    ),
    index("idx_channel_inventory_allotments_product_updated").on(table.productId, table.updatedAt),
    index("idx_channel_inventory_allotments_option_updated").on(table.optionId, table.updatedAt),
    index("idx_channel_inventory_allotments_start_time_updated").on(
      table.startTimeId,
      table.updatedAt,
    ),
    index("idx_channel_inventory_allotments_active_updated").on(table.active, table.updatedAt),
  ],
)

export const channelInventoryAllotmentTargets = pgTable(
  "channel_inventory_allotment_targets",
  {
    id: typeId("channel_inventory_allotment_targets"),
    allotmentId: typeIdRef("allotment_id")
      .notNull()
      .references(() => channelInventoryAllotments.id, { onDelete: "cascade" }),
    slotId: typeIdRef("slot_id"),
    startTimeId: typeIdRef("start_time_id"),
    dateLocal: date("date_local"),
    guaranteedCapacity: integer("guaranteed_capacity"),
    maxCapacity: integer("max_capacity"),
    soldCapacity: integer("sold_capacity"),
    remainingCapacity: integer("remaining_capacity"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_channel_inventory_allotment_targets_updated").on(table.updatedAt),
    index("idx_channel_inventory_allotment_targets_allotment_updated").on(
      table.allotmentId,
      table.updatedAt,
    ),
    index("idx_channel_inventory_allotment_targets_slot_updated").on(table.slotId, table.updatedAt),
    index("idx_channel_inventory_allotment_targets_start_time_updated").on(
      table.startTimeId,
      table.updatedAt,
    ),
    index("idx_channel_inventory_allotment_targets_date_updated").on(
      table.dateLocal,
      table.updatedAt,
    ),
    index("idx_channel_inventory_allotment_targets_active_updated").on(
      table.active,
      table.updatedAt,
    ),
  ],
)

export const channelInventoryReleaseRules = pgTable(
  "channel_inventory_release_rules",
  {
    id: typeId("channel_inventory_release_rules"),
    allotmentId: typeIdRef("allotment_id")
      .notNull()
      .references(() => channelInventoryAllotments.id, { onDelete: "cascade" }),
    releaseMode: channelAllotmentReleaseModeEnum("release_mode").notNull().default("automatic"),
    releaseDaysBeforeStart: integer("release_days_before_start"),
    releaseHoursBeforeStart: integer("release_hours_before_start"),
    unsoldAction: channelAllotmentUnsoldActionEnum("unsold_action")
      .notNull()
      .default("release_to_general_pool"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_channel_inventory_release_rules_updated").on(table.updatedAt),
    index("idx_channel_inventory_release_rules_allotment_updated").on(
      table.allotmentId,
      table.updatedAt,
    ),
    index("idx_channel_inventory_release_rules_mode_updated").on(
      table.releaseMode,
      table.updatedAt,
    ),
  ],
)

export const channelInventoryReleaseExecutions = pgTable(
  "channel_inventory_release_executions",
  {
    id: typeId("channel_inventory_release_executions"),
    allotmentId: typeIdRef("allotment_id")
      .notNull()
      .references(() => channelInventoryAllotments.id, { onDelete: "cascade" }),
    releaseRuleId: typeIdRef("release_rule_id").references(() => channelInventoryReleaseRules.id, {
      onDelete: "set null",
    }),
    targetId: typeIdRef("target_id").references(() => channelInventoryAllotmentTargets.id, {
      onDelete: "set null",
    }),
    slotId: typeIdRef("slot_id"),
    actionTaken: channelReleaseExecutionActionEnum("action_taken").notNull().default("released"),
    status: channelReleaseExecutionStatusEnum("status").notNull().default("pending"),
    releasedCapacity: integer("released_capacity"),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_channel_inventory_release_executions_updated").on(table.updatedAt),
    index("idx_channel_inventory_release_executions_allotment_updated").on(
      table.allotmentId,
      table.updatedAt,
    ),
    index("idx_channel_inventory_release_executions_rule_updated").on(
      table.releaseRuleId,
      table.updatedAt,
    ),
    index("idx_channel_inventory_release_executions_target_updated").on(
      table.targetId,
      table.updatedAt,
    ),
    index("idx_channel_inventory_release_executions_slot_updated").on(
      table.slotId,
      table.updatedAt,
    ),
    index("idx_channel_inventory_release_executions_status_updated").on(
      table.status,
      table.updatedAt,
    ),
  ],
)

export type ChannelInventoryAllotment = typeof channelInventoryAllotments.$inferSelect
export type NewChannelInventoryAllotment = typeof channelInventoryAllotments.$inferInsert
export type ChannelInventoryAllotmentTarget = typeof channelInventoryAllotmentTargets.$inferSelect
export type NewChannelInventoryAllotmentTarget =
  typeof channelInventoryAllotmentTargets.$inferInsert
export type ChannelInventoryReleaseRule = typeof channelInventoryReleaseRules.$inferSelect
export type NewChannelInventoryReleaseRule = typeof channelInventoryReleaseRules.$inferInsert
export type ChannelInventoryReleaseExecution = typeof channelInventoryReleaseExecutions.$inferSelect
export type NewChannelInventoryReleaseExecution =
  typeof channelInventoryReleaseExecutions.$inferInsert
