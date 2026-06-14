import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { relations } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const resourceKindEnum = pgEnum("resource_kind", [
  "guide",
  "vehicle",
  "room",
  "boat",
  "equipment",
  "other",
])

export const resourceAllocationModeEnum = pgEnum("resource_allocation_mode", [
  "shared",
  "exclusive",
])

export const resourceAssignmentStatusEnum = pgEnum("resource_assignment_status", [
  "reserved",
  "assigned",
  "released",
  "cancelled",
  "completed",
])

export const resources = pgTable(
  "resources",
  {
    id: typeId("resources"),
    supplierId: text("supplier_id"),
    facilityId: text("facility_id"),
    kind: resourceKindEnum("kind").notNull(),
    name: text("name").notNull(),
    code: text("code"),
    capacity: integer("capacity"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_resources_created").on(table.createdAt),
    index("idx_resources_supplier_created").on(table.supplierId, table.createdAt),
    index("idx_resources_facility_created").on(table.facilityId, table.createdAt),
    index("idx_resources_kind_created").on(table.kind, table.createdAt),
    index("idx_resources_active_created").on(table.active, table.createdAt),
  ],
)

export const resourcePools = pgTable(
  "resource_pools",
  {
    id: typeId("resource_pools"),
    productId: text("product_id"),
    kind: resourceKindEnum("kind").notNull(),
    name: text("name").notNull(),
    sharedCapacity: integer("shared_capacity"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_resource_pools_created").on(table.createdAt),
    index("idx_resource_pools_product_created").on(table.productId, table.createdAt),
    index("idx_resource_pools_kind_created").on(table.kind, table.createdAt),
    index("idx_resource_pools_active_created").on(table.active, table.createdAt),
  ],
)

export const resourcePoolMembers = pgTable(
  "resource_pool_members",
  {
    id: typeId("resource_pool_members"),
    poolId: typeIdRef("pool_id")
      .notNull()
      .references(() => resourcePools.id, { onDelete: "cascade" }),
    resourceId: typeIdRef("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_resource_pool_members_created").on(table.createdAt),
    index("idx_resource_pool_members_pool_created").on(table.poolId, table.createdAt),
    index("idx_resource_pool_members_resource_created").on(table.resourceId, table.createdAt),
  ],
)

export const resourceRequirements = pgTable(
  "resource_requirements",
  {
    id: typeId("resource_requirements"),
    poolId: typeIdRef("pool_id")
      .notNull()
      .references(() => resourcePools.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    availabilityRuleId: text("availability_rule_id"),
    startTimeId: text("start_time_id"),
    quantityRequired: integer("quantity_required").notNull().default(1),
    allocationMode: resourceAllocationModeEnum("allocation_mode").notNull().default("shared"),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_resource_requirements_pool_priority_created").on(
      table.poolId,
      table.priority,
      table.createdAt,
    ),
    index("idx_resource_requirements_product_priority_created").on(
      table.productId,
      table.priority,
      table.createdAt,
    ),
    index("idx_resource_requirements_rule_priority_created").on(
      table.availabilityRuleId,
      table.priority,
      table.createdAt,
    ),
    index("idx_resource_requirements_start_time_priority_created").on(
      table.startTimeId,
      table.priority,
      table.createdAt,
    ),
  ],
)

export const resourceSlotAssignments = pgTable(
  "resource_slot_assignments",
  {
    id: typeId("resource_slot_assignments"),
    slotId: text("slot_id").notNull(),
    poolId: typeIdRef("pool_id").references(() => resourcePools.id, { onDelete: "set null" }),
    resourceId: typeIdRef("resource_id").references(() => resources.id, { onDelete: "set null" }),
    bookingId: text("booking_id"),
    status: resourceAssignmentStatusEnum("status").notNull().default("reserved"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    assignedBy: text("assigned_by"),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (table) => [
    index("idx_resource_slot_assignments_slot_assigned").on(table.slotId, table.assignedAt),
    index("idx_resource_slot_assignments_pool_assigned").on(table.poolId, table.assignedAt),
    index("idx_resource_slot_assignments_resource_assigned").on(table.resourceId, table.assignedAt),
    index("idx_resource_slot_assignments_booking_assigned").on(table.bookingId, table.assignedAt),
    index("idx_resource_slot_assignments_status_assigned").on(table.status, table.assignedAt),
  ],
)

export const resourceCloseouts = pgTable(
  "resource_closeouts",
  {
    id: typeId("resource_closeouts"),
    resourceId: typeIdRef("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    dateLocal: date("date_local").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    reason: text("reason"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_resource_closeouts_resource_created").on(table.resourceId, table.createdAt),
    index("idx_resource_closeouts_date_created").on(table.dateLocal, table.createdAt),
  ],
)

export type Resource = typeof resources.$inferSelect
export type NewResource = typeof resources.$inferInsert
export type ResourcePool = typeof resourcePools.$inferSelect
export type NewResourcePool = typeof resourcePools.$inferInsert
export type ResourcePoolMember = typeof resourcePoolMembers.$inferSelect
export type NewResourcePoolMember = typeof resourcePoolMembers.$inferInsert
export type ResourceRequirement = typeof resourceRequirements.$inferSelect
export type NewResourceRequirement = typeof resourceRequirements.$inferInsert
export type ResourceSlotAssignment = typeof resourceSlotAssignments.$inferSelect
export type NewResourceSlotAssignment = typeof resourceSlotAssignments.$inferInsert
export type ResourceCloseout = typeof resourceCloseouts.$inferSelect
export type NewResourceCloseout = typeof resourceCloseouts.$inferInsert

export const resourceAllocations = resourceRequirements
export type ResourceAllocation = ResourceRequirement
export type NewResourceAllocation = NewResourceRequirement

export const resourcesRelations = relations(resources, ({ many }) => ({
  poolMembers: many(resourcePoolMembers),
  slotAssignments: many(resourceSlotAssignments),
  closeouts: many(resourceCloseouts),
}))

export const resourcePoolsRelations = relations(resourcePools, ({ many }) => ({
  members: many(resourcePoolMembers),
  requirements: many(resourceRequirements),
  allocations: many(resourceRequirements),
  slotAssignments: many(resourceSlotAssignments),
}))

export const resourcePoolMembersRelations = relations(resourcePoolMembers, ({ one }) => ({
  pool: one(resourcePools, {
    fields: [resourcePoolMembers.poolId],
    references: [resourcePools.id],
  }),
  resource: one(resources, {
    fields: [resourcePoolMembers.resourceId],
    references: [resources.id],
  }),
}))

export const resourceRequirementsRelations = relations(resourceRequirements, ({ one }) => ({
  pool: one(resourcePools, {
    fields: [resourceRequirements.poolId],
    references: [resourcePools.id],
  }),
}))

export const resourceAllocationsRelations = resourceRequirementsRelations

export const resourceSlotAssignmentsRelations = relations(resourceSlotAssignments, ({ one }) => ({
  pool: one(resourcePools, {
    fields: [resourceSlotAssignments.poolId],
    references: [resourcePools.id],
  }),
  resource: one(resources, {
    fields: [resourceSlotAssignments.resourceId],
    references: [resources.id],
  }),
}))

export const resourceCloseoutsRelations = relations(resourceCloseouts, ({ one }) => ({
  resource: one(resources, {
    fields: [resourceCloseouts.resourceId],
    references: [resources.id],
  }),
}))
