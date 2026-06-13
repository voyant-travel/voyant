import { z } from "zod"

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const facilityKindSchema = z.enum([
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

export const facilityStatusSchema = z.enum(["active", "inactive", "archived"])
export const facilityOwnerTypeSchema = z.enum(["supplier", "organization", "internal", "other"])
export const facilityContactRoleSchema = z.enum([
  "general",
  "reservations",
  "operations",
  "front_desk",
  "sales",
  "emergency",
  "other",
])
export const facilityFeatureCategorySchema = z.enum([
  "amenity",
  "accessibility",
  "security",
  "service",
  "policy",
  "other",
])
export const facilityDayOfWeekSchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
])
export const propertyTypeSchema = z.enum([
  "hotel",
  "resort",
  "villa",
  "apartment",
  "hostel",
  "lodge",
  "camp",
  "other",
])
export const propertyGroupTypeSchema = z.enum([
  "chain",
  "brand",
  "management_company",
  "collection",
  "portfolio",
  "cluster",
  "other",
])
export const propertyGroupStatusSchema = z.enum(["active", "inactive", "archived"])
export const propertyGroupMembershipRoleSchema = z.enum([
  "member",
  "flagship",
  "managed",
  "franchise",
  "other",
])

export const facilityCoreSchema = z.object({
  parentFacilityId: z.string().nullable().optional(),
  ownerType: facilityOwnerTypeSchema.nullable().optional(),
  ownerId: z.string().nullable().optional(),
  kind: facilityKindSchema,
  status: facilityStatusSchema.default("active"),
  name: z.string().min(1).max(255),
  code: z.string().max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  tags: z.array(z.string()).default([]),
})

export const insertFacilitySchema = facilityCoreSchema
export const updateFacilitySchema = facilityCoreSchema.partial()
export const facilityListQuerySchema = paginationSchema.extend({
  kind: facilityKindSchema.optional(),
  status: facilityStatusSchema.optional(),
  ownerType: facilityOwnerTypeSchema.optional(),
  ownerId: z.string().optional(),
  parentFacilityId: z.string().optional(),
  country: z.string().optional(),
  search: z.string().optional(),
})

export const facilityContactCoreSchema = z.object({
  role: facilityContactRoleSchema.default("general"),
  name: z.string().min(1).max(255),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  notes: z.string().nullable().optional(),
  isPrimary: z.boolean().default(false),
})

export const insertFacilityContactSchema = facilityContactCoreSchema
export const updateFacilityContactSchema = facilityContactCoreSchema.partial()
export const facilityContactListQuerySchema = paginationSchema.extend({
  facilityId: z.string().optional(),
  role: facilityContactRoleSchema.optional(),
})

export const facilityFeatureCoreSchema = z.object({
  category: facilityFeatureCategorySchema.default("amenity"),
  code: z.string().max(100).nullable().optional(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  valueText: z.string().nullable().optional(),
  highlighted: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
})

export const insertFacilityFeatureSchema = facilityFeatureCoreSchema
export const updateFacilityFeatureSchema = facilityFeatureCoreSchema.partial()
export const facilityFeatureListQuerySchema = paginationSchema.extend({
  facilityId: z.string().optional(),
  category: facilityFeatureCategorySchema.optional(),
})

export const facilityOperationScheduleCoreSchema = z.object({
  dayOfWeek: facilityDayOfWeekSchema.nullable().optional(),
  validFrom: z.string().date().nullable().optional(),
  validTo: z.string().date().nullable().optional(),
  opensAt: z.string().nullable().optional(),
  closesAt: z.string().nullable().optional(),
  closed: z.boolean().default(false),
  notes: z.string().nullable().optional(),
})

export const insertFacilityOperationScheduleSchema = facilityOperationScheduleCoreSchema
export const updateFacilityOperationScheduleSchema = facilityOperationScheduleCoreSchema.partial()
export const facilityOperationScheduleListQuerySchema = paginationSchema.extend({
  facilityId: z.string().optional(),
  dayOfWeek: facilityDayOfWeekSchema.optional(),
})

export const propertyCoreSchema = z.object({
  facilityId: z.string(),
  propertyType: propertyTypeSchema.default("hotel"),
  brandName: z.string().nullable().optional(),
  groupName: z.string().nullable().optional(),
  rating: z.number().int().min(0).max(10).nullable().optional(),
  ratingScale: z.number().int().min(1).max(10).nullable().optional(),
  checkInTime: z.string().nullable().optional(),
  checkOutTime: z.string().nullable().optional(),
  policyNotes: z.string().nullable().optional(),
  amenityNotes: z.string().nullable().optional(),
})

export const insertPropertySchema = propertyCoreSchema
export const updatePropertySchema = propertyCoreSchema.partial()
export const propertyListQuerySchema = paginationSchema.extend({
  facilityId: z.string().optional(),
  propertyType: propertyTypeSchema.optional(),
  groupName: z.string().optional(),
  search: z.string().optional(),
})

export const propertyGroupCoreSchema = z.object({
  parentGroupId: z.string().nullable().optional(),
  groupType: propertyGroupTypeSchema.default("chain"),
  status: propertyGroupStatusSchema.default("active"),
  name: z.string().min(1).max(255),
  code: z.string().max(100).nullable().optional(),
  brandName: z.string().nullable().optional(),
  legalName: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertPropertyGroupSchema = propertyGroupCoreSchema
export const updatePropertyGroupSchema = propertyGroupCoreSchema.partial()
export const propertyGroupListQuerySchema = paginationSchema.extend({
  parentGroupId: z.string().optional(),
  groupType: propertyGroupTypeSchema.optional(),
  status: propertyGroupStatusSchema.optional(),
  search: z.string().optional(),
})

export const propertyGroupMemberCoreSchema = z.object({
  groupId: z.string(),
  propertyId: z.string(),
  membershipRole: propertyGroupMembershipRoleSchema.default("member"),
  isPrimary: z.boolean().default(false),
  validFrom: z.string().date().nullable().optional(),
  validTo: z.string().date().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const insertPropertyGroupMemberSchema = propertyGroupMemberCoreSchema
export const updatePropertyGroupMemberSchema = propertyGroupMemberCoreSchema.partial()
export const propertyGroupMemberListQuerySchema = paginationSchema.extend({
  groupId: z.string().optional(),
  propertyId: z.string().optional(),
  membershipRole: propertyGroupMembershipRoleSchema.optional(),
})
