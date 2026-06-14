import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import type { IdentityNamedContact, NewIdentityNamedContact } from "@voyantjs/identity/schema"
import { relations } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const facilityKindEnum = pgEnum("facility_kind", [
  "property",
  "hotel",
  "resort",
  "venue",
  "meeting_point",
  "transfer_hub",
  "airport",
  "station",
  "marina",
  "camp",
  "lodge",
  "office",
  "attraction",
  "restaurant",
  "other",
])

export const facilityStatusEnum = pgEnum("facility_status", ["active", "inactive", "archived"])

export const facilityOwnerTypeEnum = pgEnum("facility_owner_type", [
  "supplier",
  "organization",
  "internal",
  "other",
])

export const facilityFeatureCategoryEnum = pgEnum("facility_feature_category", [
  "amenity",
  "accessibility",
  "security",
  "service",
  "policy",
  "other",
])

export const facilityDayOfWeekEnum = pgEnum("facility_day_of_week", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
])

export const propertyTypeEnum = pgEnum("property_type", [
  "hotel",
  "resort",
  "villa",
  "apartment",
  "hostel",
  "lodge",
  "camp",
  "other",
])

export const propertyGroupTypeEnum = pgEnum("property_group_type", [
  "chain",
  "brand",
  "management_company",
  "collection",
  "portfolio",
  "cluster",
  "other",
])

export const propertyGroupStatusEnum = pgEnum("property_group_status", [
  "active",
  "inactive",
  "archived",
])

export const propertyGroupMembershipRoleEnum = pgEnum("property_group_membership_role", [
  "member",
  "flagship",
  "managed",
  "franchise",
  "other",
])

export const facilities = pgTable(
  "facilities",
  {
    id: typeId("facilities"),
    parentFacilityId: typeIdRef("parent_facility_id").references((): AnyPgColumn => facilities.id, {
      onDelete: "set null",
    }),
    ownerType: facilityOwnerTypeEnum("owner_type"),
    ownerId: text("owner_id"),
    kind: facilityKindEnum("kind").notNull(),
    status: facilityStatusEnum("status").notNull().default("active"),
    name: text("name").notNull(),
    code: text("code"),
    description: text("description"),
    timezone: text("timezone"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_facilities_parent_updated").on(table.parentFacilityId, table.updatedAt),
    index("idx_facilities_owner_updated").on(table.ownerType, table.ownerId, table.updatedAt),
    index("idx_facilities_owner_id_updated").on(table.ownerId, table.updatedAt),
    index("idx_facilities_kind_updated").on(table.kind, table.updatedAt),
    index("idx_facilities_status_updated").on(table.status, table.updatedAt),
    uniqueIndex("uidx_facilities_code").on(table.code),
  ],
)

export const facilityAddressProjections = pgTable(
  "facility_address_projections",
  {
    facilityId: typeIdRef("facility_id")
      .primaryKey()
      .references(() => facilities.id, { onDelete: "cascade" }),
    addressId: text("address_id"),
    fullText: text("full_text"),
    line1: text("line1"),
    line2: text("line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    country: text("country"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    address: text("address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_facility_address_projections_country").on(table.country),
    index("idx_facility_address_projections_city_country").on(table.city, table.country),
  ],
)

export const facilityFeatures = pgTable(
  "facility_features",
  {
    id: typeId("facility_features"),
    facilityId: typeIdRef("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    category: facilityFeatureCategoryEnum("category").notNull().default("amenity"),
    code: text("code"),
    name: text("name").notNull(),
    description: text("description"),
    valueText: text("value_text"),
    highlighted: boolean("highlighted").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_facility_features_facility_sort_name").on(
      table.facilityId,
      table.sortOrder,
      table.name,
    ),
    index("idx_facility_features_category_sort_name").on(
      table.category,
      table.sortOrder,
      table.name,
    ),
    index("idx_facility_features_facility_category_sort_name").on(
      table.facilityId,
      table.category,
      table.sortOrder,
      table.name,
    ),
  ],
)

export const facilityOperationSchedules = pgTable(
  "facility_operation_schedules",
  {
    id: typeId("facility_operation_schedules"),
    facilityId: typeIdRef("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    dayOfWeek: facilityDayOfWeekEnum("day_of_week"),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    opensAt: text("opens_at"),
    closesAt: text("closes_at"),
    closed: boolean("closed").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_facility_operation_schedules_facility_day_valid").on(
      table.facilityId,
      table.dayOfWeek,
      table.validFrom,
    ),
    index("idx_facility_operation_schedules_day_valid").on(table.dayOfWeek, table.validFrom),
  ],
)

export const properties = pgTable(
  "properties",
  {
    id: typeId("properties"),
    facilityId: typeIdRef("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    propertyType: propertyTypeEnum("property_type").notNull().default("hotel"),
    brandName: text("brand_name"),
    groupName: text("group_name"),
    rating: integer("rating"),
    ratingScale: integer("rating_scale"),
    checkInTime: text("check_in_time"),
    checkOutTime: text("check_out_time"),
    policyNotes: text("policy_notes"),
    amenityNotes: text("amenity_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_properties_facility").on(table.facilityId),
    index("idx_properties_updated").on(table.updatedAt),
    index("idx_properties_type_updated").on(table.propertyType, table.updatedAt),
    index("idx_properties_group_updated").on(table.groupName, table.updatedAt),
  ],
)

export const propertyGroups = pgTable(
  "property_groups",
  {
    id: typeId("property_groups"),
    parentGroupId: typeIdRef("parent_group_id").references((): AnyPgColumn => propertyGroups.id, {
      onDelete: "set null",
    }),
    groupType: propertyGroupTypeEnum("group_type").notNull().default("chain"),
    status: propertyGroupStatusEnum("status").notNull().default("active"),
    name: text("name").notNull(),
    code: text("code"),
    brandName: text("brand_name"),
    legalName: text("legal_name"),
    website: text("website"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_property_groups_parent_updated").on(table.parentGroupId, table.updatedAt),
    index("idx_property_groups_updated").on(table.updatedAt),
    index("idx_property_groups_type_updated").on(table.groupType, table.updatedAt),
    index("idx_property_groups_status_updated").on(table.status, table.updatedAt),
    uniqueIndex("uidx_property_groups_code").on(table.code),
  ],
)

export const propertyGroupMembers = pgTable(
  "property_group_members",
  {
    id: typeId("property_group_members"),
    groupId: typeIdRef("group_id")
      .notNull()
      .references(() => propertyGroups.id, { onDelete: "cascade" }),
    propertyId: typeIdRef("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    membershipRole: propertyGroupMembershipRoleEnum("membership_role").notNull().default("member"),
    isPrimary: boolean("is_primary").notNull().default(false),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_property_group_members_group_updated").on(table.groupId, table.updatedAt),
    index("idx_property_group_members_updated").on(table.updatedAt),
    index("idx_property_group_members_property_updated").on(table.propertyId, table.updatedAt),
    index("idx_property_group_members_role_updated").on(table.membershipRole, table.updatedAt),
    uniqueIndex("uidx_property_group_members_pair").on(table.groupId, table.propertyId),
  ],
)

export type Facility = typeof facilities.$inferSelect
export type NewFacility = typeof facilities.$inferInsert
export type FacilityAddressProjection = typeof facilityAddressProjections.$inferSelect
export type NewFacilityAddressProjection = typeof facilityAddressProjections.$inferInsert
export type FacilityContact = IdentityNamedContact
export type NewFacilityContact = NewIdentityNamedContact
export type FacilityFeature = typeof facilityFeatures.$inferSelect
export type NewFacilityFeature = typeof facilityFeatures.$inferInsert
export type FacilityOperationSchedule = typeof facilityOperationSchedules.$inferSelect
export type NewFacilityOperationSchedule = typeof facilityOperationSchedules.$inferInsert
export type Property = typeof properties.$inferSelect
export type NewProperty = typeof properties.$inferInsert
export type PropertyGroup = typeof propertyGroups.$inferSelect
export type NewPropertyGroup = typeof propertyGroups.$inferInsert
export type PropertyGroupMember = typeof propertyGroupMembers.$inferSelect
export type NewPropertyGroupMember = typeof propertyGroupMembers.$inferInsert

export const facilitiesRelations = relations(facilities, ({ one, many }) => ({
  parentFacility: one(facilities, {
    fields: [facilities.parentFacilityId],
    references: [facilities.id],
    relationName: "facility_parent",
  }),
  childFacilities: many(facilities, { relationName: "facility_parent" }),
  features: many(facilityFeatures),
  operationSchedules: many(facilityOperationSchedules),
  addressProjection: one(facilityAddressProjections, {
    fields: [facilities.id],
    references: [facilityAddressProjections.facilityId],
  }),
  property: one(properties, {
    fields: [facilities.id],
    references: [properties.facilityId],
  }),
}))

export const facilityAddressProjectionsRelations = relations(
  facilityAddressProjections,
  ({ one }) => ({
    facility: one(facilities, {
      fields: [facilityAddressProjections.facilityId],
      references: [facilities.id],
    }),
  }),
)

export const facilityFeaturesRelations = relations(facilityFeatures, ({ one }) => ({
  facility: one(facilities, {
    fields: [facilityFeatures.facilityId],
    references: [facilities.id],
  }),
}))

export const facilityOperationSchedulesRelations = relations(
  facilityOperationSchedules,
  ({ one }) => ({
    facility: one(facilities, {
      fields: [facilityOperationSchedules.facilityId],
      references: [facilities.id],
    }),
  }),
)

export const propertiesRelations = relations(properties, ({ one }) => ({
  facility: one(facilities, {
    fields: [properties.facilityId],
    references: [facilities.id],
  }),
}))

export const propertyGroupsRelations = relations(propertyGroups, ({ one, many }) => ({
  parentGroup: one(propertyGroups, {
    fields: [propertyGroups.parentGroupId],
    references: [propertyGroups.id],
    relationName: "property_group_parent",
  }),
  childGroups: many(propertyGroups, { relationName: "property_group_parent" }),
  members: many(propertyGroupMembers),
}))

export const propertyGroupMembersRelations = relations(propertyGroupMembers, ({ one }) => ({
  group: one(propertyGroups, {
    fields: [propertyGroupMembers.groupId],
    references: [propertyGroups.id],
  }),
  property: one(properties, {
    fields: [propertyGroupMembers.propertyId],
    references: [properties.id],
  }),
}))
