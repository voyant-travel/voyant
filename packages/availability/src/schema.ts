import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { relations } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const availabilitySlotStatusEnum = pgEnum("availability_slot_status", [
  "open",
  "closed",
  "sold_out",
  "cancelled",
])

export const meetingModeEnum = pgEnum("meeting_mode", [
  "meeting_only",
  "pickup_only",
  "meet_or_pickup",
])

export const pickupGroupKindEnum = pgEnum("pickup_group_kind", ["pickup", "dropoff", "meeting"])

export const pickupTimingModeEnum = pgEnum("pickup_timing_mode", [
  "fixed_time",
  "offset_from_start",
])

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: typeId("availability_rules"),
    productId: text("product_id").notNull(),
    optionId: text("option_id"),
    facilityId: text("facility_id"),
    timezone: text("timezone").notNull(),
    recurrenceRule: text("recurrence_rule").notNull(),
    maxCapacity: integer("max_capacity").notNull(),
    maxPickupCapacity: integer("max_pickup_capacity"),
    minTotalPax: integer("min_total_pax"),
    cutoffMinutes: integer("cutoff_minutes"),
    earlyBookingLimitMinutes: integer("early_booking_limit_minutes"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_availability_rules_updated").on(table.updatedAt),
    index("idx_availability_rules_product_updated").on(table.productId, table.updatedAt),
    index("idx_availability_rules_option_updated").on(table.optionId, table.updatedAt),
    index("idx_availability_rules_facility_updated").on(table.facilityId, table.updatedAt),
    index("idx_availability_rules_active_updated").on(table.active, table.updatedAt),
  ],
)

export const availabilityStartTimes = pgTable(
  "availability_start_times",
  {
    id: typeId("availability_start_times"),
    productId: text("product_id").notNull(),
    optionId: text("option_id"),
    facilityId: text("facility_id"),
    label: text("label"),
    startTimeLocal: text("start_time_local").notNull(),
    durationMinutes: integer("duration_minutes"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_availability_start_times_product_sort_created").on(
      table.productId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_availability_start_times_option_sort_created").on(
      table.optionId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_availability_start_times_facility_sort_created").on(
      table.facilityId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_availability_start_times_active_sort_created").on(
      table.active,
      table.sortOrder,
      table.createdAt,
    ),
  ],
)

export const availabilitySlots = pgTable(
  "availability_slots",
  {
    id: typeId("availability_slots"),
    productId: text("product_id").notNull(),
    itineraryId: text("itinerary_id"),
    optionId: text("option_id"),
    facilityId: text("facility_id"),
    availabilityRuleId: typeIdRef("availability_rule_id").references(() => availabilityRules.id, {
      onDelete: "set null",
    }),
    startTimeId: typeIdRef("start_time_id").references(() => availabilityStartTimes.id, {
      onDelete: "set null",
    }),
    dateLocal: date("date_local").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    timezone: text("timezone").notNull(),
    status: availabilitySlotStatusEnum("status").notNull().default("open"),
    unlimited: boolean("unlimited").notNull().default(false),
    initialPax: integer("initial_pax"),
    remainingPax: integer("remaining_pax"),
    initialPickups: integer("initial_pickups"),
    remainingPickups: integer("remaining_pickups"),
    remainingResources: integer("remaining_resources"),
    pastCutoff: boolean("past_cutoff").notNull().default(false),
    tooEarly: boolean("too_early").notNull().default(false),
    nights: integer("nights"),
    days: integer("days"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_availability_slots_product_starts_at").on(table.productId, table.startsAt),
    index("idx_availability_slots_itinerary_starts_at").on(table.itineraryId, table.startsAt),
    index("idx_availability_slots_option_starts_at").on(table.optionId, table.startsAt),
    index("idx_availability_slots_facility_starts_at").on(table.facilityId, table.startsAt),
    index("idx_availability_slots_rule_starts_at").on(table.availabilityRuleId, table.startsAt),
    index("idx_availability_slots_start_time_starts_at").on(table.startTimeId, table.startsAt),
    index("idx_availability_slots_date_starts_at").on(table.dateLocal, table.startsAt),
    index("idx_availability_slots_status_starts_at").on(table.status, table.startsAt),
  ],
)

export const availabilityCloseouts = pgTable(
  "availability_closeouts",
  {
    id: typeId("availability_closeouts"),
    productId: text("product_id").notNull(),
    slotId: typeIdRef("slot_id").references(() => availabilitySlots.id, { onDelete: "set null" }),
    dateLocal: date("date_local").notNull(),
    reason: text("reason"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_availability_closeouts_product_created").on(table.productId, table.createdAt),
    index("idx_availability_closeouts_slot_created").on(table.slotId, table.createdAt),
    index("idx_availability_closeouts_date_created").on(table.dateLocal, table.createdAt),
  ],
)

export const allocationResources = pgTable(
  "allocation_resources",
  {
    id: typeId("allocation_resources"),
    slotId: typeIdRef("slot_id")
      .notNull()
      .references(() => availabilitySlots.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    label: text("label"),
    capacity: integer("capacity").notNull(),
    flags: jsonb("flags").$type<Record<string, unknown>>().notNull().default({}),
    parentId: text("parent_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_allocation_resources_slot_kind").on(table.slotId, table.kind),
    index("idx_allocation_resources_parent").on(table.parentId),
    index("idx_allocation_resources_kind_sort").on(table.kind, table.sortOrder, table.createdAt),
  ],
)

export const sharingGroupLabels = pgTable("sharing_group_labels", {
  groupId: text("group_id").primaryKey(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const allocationAuditLog = pgTable(
  "allocation_audit_log",
  {
    id: typeId("allocation_audit_log"),
    slotId: typeIdRef("slot_id")
      .notNull()
      .references(() => availabilitySlots.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    actorId: text("actor_id"),
    travelerId: text("traveler_id"),
    resourceId: text("resource_id"),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_allocation_audit_slot_created").on(table.slotId, table.createdAt),
    index("idx_allocation_audit_traveler").on(table.travelerId),
  ],
)

export const productOptionResourceTemplates = pgTable(
  "product_option_resource_templates",
  {
    id: typeId("product_option_resource_templates"),
    productOptionId: text("product_option_id").notNull(),
    kind: text("kind").notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    capacity: integer("capacity").notNull(),
    namePattern: text("name_pattern").notNull(),
    layout: text("layout"),
    flags: jsonb("flags").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_product_option_resource_templates_option_kind").on(
      table.productOptionId,
      table.kind,
    ),
    index("idx_product_option_resource_templates_kind").on(table.kind, table.createdAt),
  ],
)

export const availabilityPickupPoints = pgTable(
  "availability_pickup_points",
  {
    id: typeId("availability_pickup_points"),
    productId: text("product_id").notNull(),
    facilityId: text("facility_id"),
    name: text("name").notNull(),
    description: text("description"),
    locationText: text("location_text"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_availability_pickup_points_created").on(table.createdAt),
    index("idx_availability_pickup_points_product_created").on(table.productId, table.createdAt),
    index("idx_availability_pickup_points_facility_created").on(table.facilityId, table.createdAt),
    index("idx_availability_pickup_points_active_created").on(table.active, table.createdAt),
  ],
)

export const availabilitySlotPickups = pgTable(
  "availability_slot_pickups",
  {
    id: typeId("availability_slot_pickups"),
    slotId: typeIdRef("slot_id")
      .notNull()
      .references(() => availabilitySlots.id, { onDelete: "cascade" }),
    pickupPointId: typeIdRef("pickup_point_id")
      .notNull()
      .references(() => availabilityPickupPoints.id, { onDelete: "cascade" }),
    initialCapacity: integer("initial_capacity"),
    remainingCapacity: integer("remaining_capacity"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_availability_slot_pickups_created").on(table.createdAt),
    index("idx_availability_slot_pickups_slot_created").on(table.slotId, table.createdAt),
    index("idx_availability_slot_pickups_pickup_point_created").on(
      table.pickupPointId,
      table.createdAt,
    ),
  ],
)

export const productMeetingConfigs = pgTable(
  "product_meeting_configs",
  {
    id: typeId("product_meeting_configs"),
    productId: text("product_id").notNull(),
    optionId: text("option_id"),
    facilityId: text("facility_id"),
    mode: meetingModeEnum("mode").notNull().default("meeting_only"),
    allowCustomPickup: boolean("allow_custom_pickup").notNull().default(false),
    allowCustomDropoff: boolean("allow_custom_dropoff").notNull().default(false),
    requiresPickupSelection: boolean("requires_pickup_selection").notNull().default(false),
    requiresDropoffSelection: boolean("requires_dropoff_selection").notNull().default(false),
    usePickupAllotment: boolean("use_pickup_allotment").notNull().default(false),
    meetingInstructions: text("meeting_instructions"),
    pickupInstructions: text("pickup_instructions"),
    dropoffInstructions: text("dropoff_instructions"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_product_meeting_configs_updated").on(table.updatedAt),
    index("idx_product_meeting_configs_product_updated").on(table.productId, table.updatedAt),
    index("idx_product_meeting_configs_option_updated").on(table.optionId, table.updatedAt),
    index("idx_product_meeting_configs_facility_updated").on(table.facilityId, table.updatedAt),
    index("idx_product_meeting_configs_mode_updated").on(table.mode, table.updatedAt),
    index("idx_product_meeting_configs_active_updated").on(table.active, table.updatedAt),
  ],
)

export const pickupGroups = pgTable(
  "pickup_groups",
  {
    id: typeId("pickup_groups"),
    meetingConfigId: typeIdRef("meeting_config_id")
      .notNull()
      .references(() => productMeetingConfigs.id, { onDelete: "cascade" }),
    kind: pickupGroupKindEnum("kind").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_pickup_groups_sort_created").on(table.sortOrder, table.createdAt),
    index("idx_pickup_groups_meeting_config_sort_created").on(
      table.meetingConfigId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_pickup_groups_kind_sort_created").on(table.kind, table.sortOrder, table.createdAt),
    index("idx_pickup_groups_active_sort_created").on(
      table.active,
      table.sortOrder,
      table.createdAt,
    ),
  ],
)

export const pickupLocations = pgTable(
  "pickup_locations",
  {
    id: typeId("pickup_locations"),
    groupId: typeIdRef("group_id")
      .notNull()
      .references(() => pickupGroups.id, { onDelete: "cascade" }),
    facilityId: text("facility_id"),
    name: text("name").notNull(),
    description: text("description"),
    locationText: text("location_text"),
    leadTimeMinutes: integer("lead_time_minutes"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_pickup_locations_sort_created").on(table.sortOrder, table.createdAt),
    index("idx_pickup_locations_group_sort_created").on(
      table.groupId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_pickup_locations_facility_sort_created").on(
      table.facilityId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_pickup_locations_active_sort_created").on(
      table.active,
      table.sortOrder,
      table.createdAt,
    ),
  ],
)

export const locationPickupTimes = pgTable(
  "location_pickup_times",
  {
    id: typeId("location_pickup_times"),
    pickupLocationId: typeIdRef("pickup_location_id")
      .notNull()
      .references(() => pickupLocations.id, { onDelete: "cascade" }),
    slotId: typeIdRef("slot_id").references(() => availabilitySlots.id, { onDelete: "cascade" }),
    startTimeId: typeIdRef("start_time_id").references(() => availabilityStartTimes.id, {
      onDelete: "set null",
    }),
    timingMode: pickupTimingModeEnum("timing_mode").notNull().default("fixed_time"),
    localTime: text("local_time"),
    offsetMinutes: integer("offset_minutes"),
    instructions: text("instructions"),
    initialCapacity: integer("initial_capacity"),
    remainingCapacity: integer("remaining_capacity"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_location_pickup_times_created").on(table.createdAt),
    index("idx_location_pickup_times_pickup_location_created").on(
      table.pickupLocationId,
      table.createdAt,
    ),
    index("idx_location_pickup_times_slot_created").on(table.slotId, table.createdAt),
    index("idx_location_pickup_times_start_time_created").on(table.startTimeId, table.createdAt),
    index("idx_location_pickup_times_active_created").on(table.active, table.createdAt),
  ],
)

export const customPickupAreas = pgTable(
  "custom_pickup_areas",
  {
    id: typeId("custom_pickup_areas"),
    meetingConfigId: typeIdRef("meeting_config_id")
      .notNull()
      .references(() => productMeetingConfigs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    geographicText: text("geographic_text"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_custom_pickup_areas_created").on(table.createdAt),
    index("idx_custom_pickup_areas_meeting_config_created").on(
      table.meetingConfigId,
      table.createdAt,
    ),
    index("idx_custom_pickup_areas_active_created").on(table.active, table.createdAt),
  ],
)

export type AvailabilityRule = typeof availabilityRules.$inferSelect
export type NewAvailabilityRule = typeof availabilityRules.$inferInsert
export type AvailabilityStartTime = typeof availabilityStartTimes.$inferSelect
export type NewAvailabilityStartTime = typeof availabilityStartTimes.$inferInsert
export type AvailabilitySlot = typeof availabilitySlots.$inferSelect
export type NewAvailabilitySlot = typeof availabilitySlots.$inferInsert
export type AvailabilityCloseout = typeof availabilityCloseouts.$inferSelect
export type NewAvailabilityCloseout = typeof availabilityCloseouts.$inferInsert
export type AllocationResource = typeof allocationResources.$inferSelect
export type NewAllocationResource = typeof allocationResources.$inferInsert
export type SharingGroupLabel = typeof sharingGroupLabels.$inferSelect
export type NewSharingGroupLabel = typeof sharingGroupLabels.$inferInsert
export type AllocationAuditLog = typeof allocationAuditLog.$inferSelect
export type NewAllocationAuditLog = typeof allocationAuditLog.$inferInsert
export type ProductOptionResourceTemplate = typeof productOptionResourceTemplates.$inferSelect
export type NewProductOptionResourceTemplate = typeof productOptionResourceTemplates.$inferInsert
export type AvailabilityPickupPoint = typeof availabilityPickupPoints.$inferSelect
export type NewAvailabilityPickupPoint = typeof availabilityPickupPoints.$inferInsert
export type AvailabilitySlotPickup = typeof availabilitySlotPickups.$inferSelect
export type NewAvailabilitySlotPickup = typeof availabilitySlotPickups.$inferInsert
export type ProductMeetingConfig = typeof productMeetingConfigs.$inferSelect
export type NewProductMeetingConfig = typeof productMeetingConfigs.$inferInsert
export type PickupGroup = typeof pickupGroups.$inferSelect
export type NewPickupGroup = typeof pickupGroups.$inferInsert
export type PickupLocation = typeof pickupLocations.$inferSelect
export type NewPickupLocation = typeof pickupLocations.$inferInsert
export type LocationPickupTime = typeof locationPickupTimes.$inferSelect
export type NewLocationPickupTime = typeof locationPickupTimes.$inferInsert
export type CustomPickupArea = typeof customPickupAreas.$inferSelect
export type NewCustomPickupArea = typeof customPickupAreas.$inferInsert

export const availabilityRulesRelations = relations(availabilityRules, ({ many }) => ({
  slots: many(availabilitySlots),
}))

export const availabilityStartTimesRelations = relations(availabilityStartTimes, ({ many }) => ({
  slots: many(availabilitySlots),
  locationPickupTimes: many(locationPickupTimes),
}))

export const availabilitySlotsRelations = relations(availabilitySlots, ({ one, many }) => ({
  rule: one(availabilityRules, {
    fields: [availabilitySlots.availabilityRuleId],
    references: [availabilityRules.id],
  }),
  startTime: one(availabilityStartTimes, {
    fields: [availabilitySlots.startTimeId],
    references: [availabilityStartTimes.id],
  }),
  pickups: many(availabilitySlotPickups),
  closeouts: many(availabilityCloseouts),
  locationPickupTimes: many(locationPickupTimes),
  allocationResources: many(allocationResources),
}))

export const availabilityCloseoutsRelations = relations(availabilityCloseouts, ({ one }) => ({
  slot: one(availabilitySlots, {
    fields: [availabilityCloseouts.slotId],
    references: [availabilitySlots.id],
  }),
}))

export const allocationResourcesRelations = relations(allocationResources, ({ one }) => ({
  slot: one(availabilitySlots, {
    fields: [allocationResources.slotId],
    references: [availabilitySlots.id],
  }),
}))

export const productOptionResourceTemplatesRelations = relations(
  productOptionResourceTemplates,
  () => ({}),
)

export const availabilityPickupPointsRelations = relations(
  availabilityPickupPoints,
  ({ many }) => ({
    slotPickups: many(availabilitySlotPickups),
  }),
)

export const availabilitySlotPickupsRelations = relations(availabilitySlotPickups, ({ one }) => ({
  slot: one(availabilitySlots, {
    fields: [availabilitySlotPickups.slotId],
    references: [availabilitySlots.id],
  }),
  pickupPoint: one(availabilityPickupPoints, {
    fields: [availabilitySlotPickups.pickupPointId],
    references: [availabilityPickupPoints.id],
  }),
}))

export const productMeetingConfigsRelations = relations(productMeetingConfigs, ({ many }) => ({
  pickupGroups: many(pickupGroups),
  customPickupAreas: many(customPickupAreas),
}))

export const pickupGroupsRelations = relations(pickupGroups, ({ one, many }) => ({
  meetingConfig: one(productMeetingConfigs, {
    fields: [pickupGroups.meetingConfigId],
    references: [productMeetingConfigs.id],
  }),
  locations: many(pickupLocations),
}))

export const pickupLocationsRelations = relations(pickupLocations, ({ one, many }) => ({
  group: one(pickupGroups, {
    fields: [pickupLocations.groupId],
    references: [pickupGroups.id],
  }),
  pickupTimes: many(locationPickupTimes),
}))

export const locationPickupTimesRelations = relations(locationPickupTimes, ({ one }) => ({
  pickupLocation: one(pickupLocations, {
    fields: [locationPickupTimes.pickupLocationId],
    references: [pickupLocations.id],
  }),
  slot: one(availabilitySlots, {
    fields: [locationPickupTimes.slotId],
    references: [availabilitySlots.id],
  }),
  startTime: one(availabilityStartTimes, {
    fields: [locationPickupTimes.startTimeId],
    references: [availabilityStartTimes.id],
  }),
}))

export const customPickupAreasRelations = relations(customPickupAreas, ({ one }) => ({
  meetingConfig: one(productMeetingConfigs, {
    fields: [customPickupAreas.meetingConfigId],
    references: [productMeetingConfigs.id],
  }),
}))

/**
 * `availability_holds` — soft holds against an availability slot,
 * tied to a `booking_drafts` row. Decrements
 * `availability_slots.remainingPax` while live; the reaper releases
 * stale holds and increments capacity back.
 *
 * Per booking-journey-architecture §5.7 + §6 — the doc proposes
 * `bookingAllocations` for owned holds, but allocations require a
 * `booking_id` FK and journey holds are pre-booking. A dedicated
 * table avoids the chicken-and-egg.
 */
export const availabilityHolds = pgTable(
  "availability_holds",
  {
    id: typeId("availability_holds"),
    /** Plain text — booking_drafts lives in @voyantjs/catalog. */
    draftId: text("draft_id").notNull(),
    /** Token returned to callers; uniquely identifies the hold for
     *  extend/release. */
    holdToken: text("hold_token").notNull(),
    productId: text("product_id").notNull(),
    slotId: typeIdRef("slot_id")
      .notNull()
      .references(() => availabilitySlots.id, { onDelete: "cascade" }),
    paxCount: integer("pax_count").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_availability_holds_slot").on(table.slotId),
    index("idx_availability_holds_draft").on(table.draftId),
    index("idx_availability_holds_token").on(table.holdToken),
    index("idx_availability_holds_expires").on(table.expiresAt),
  ],
)

export type AvailabilityHold = typeof availabilityHolds.$inferSelect
export type NewAvailabilityHold = typeof availabilityHolds.$inferInsert
