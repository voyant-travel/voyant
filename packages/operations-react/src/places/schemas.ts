import {
  insertFacilityFeatureSchema,
  insertFacilityOperationScheduleSchema,
  insertFacilitySchema,
  insertPropertyGroupMemberSchema,
  insertPropertyGroupSchema,
  insertPropertySchema,
} from "@voyantjs/operations/places"
import { z } from "zod"

export const paginatedEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })
export const successEnvelope = z.object({ success: z.boolean() })

export const facilityRecordSchema = insertFacilitySchema.extend({
  id: z.string(),
  parentFacilityId: z.string().nullable(),
  ownerType: z.string().nullable(),
  ownerId: z.string().nullable(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  timezone: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  postalCode: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  tags: z.array(z.string()),
})

export type FacilityRecord = z.infer<typeof facilityRecordSchema>
export type PlaceRecord = FacilityRecord

export const facilityFeatureRecordSchema = insertFacilityFeatureSchema.extend({
  id: z.string(),
  facilityId: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  valueText: z.string().nullable(),
})

export type FacilityFeatureRecord = z.infer<typeof facilityFeatureRecordSchema>
export type PlaceFeatureRecord = FacilityFeatureRecord

export const facilityOperationScheduleRecordSchema = insertFacilityOperationScheduleSchema.extend({
  id: z.string(),
  facilityId: z.string(),
  dayOfWeek: z.string().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  notes: z.string().nullable(),
})

export type FacilityOperationScheduleRecord = z.infer<typeof facilityOperationScheduleRecordSchema>
export type PlaceOperationScheduleRecord = FacilityOperationScheduleRecord

export const propertyRecordSchema = insertPropertySchema.extend({
  id: z.string(),
  brandName: z.string().nullable(),
  groupName: z.string().nullable(),
  rating: z.number().int().nullable(),
  ratingScale: z.number().int().nullable(),
  checkInTime: z.string().nullable(),
  checkOutTime: z.string().nullable(),
  policyNotes: z.string().nullable(),
  amenityNotes: z.string().nullable(),
})

export type PropertyRecord = z.infer<typeof propertyRecordSchema>

export const facilityListResponse = paginatedEnvelope(facilityRecordSchema)
export const facilitySingleResponse = singleEnvelope(facilityRecordSchema)
export const facilityFeatureListResponse = paginatedEnvelope(facilityFeatureRecordSchema)
export const facilityFeatureSingleResponse = singleEnvelope(facilityFeatureRecordSchema)
export const facilityOperationScheduleListResponse = paginatedEnvelope(
  facilityOperationScheduleRecordSchema,
)
export const facilityOperationScheduleSingleResponse = singleEnvelope(
  facilityOperationScheduleRecordSchema,
)
export const propertyListResponse = paginatedEnvelope(propertyRecordSchema)
export const propertySingleResponse = singleEnvelope(propertyRecordSchema)

export const propertyGroupRecordSchema = insertPropertyGroupSchema.extend({
  id: z.string(),
  parentGroupId: z.string().nullable(),
  code: z.string().nullable(),
  brandName: z.string().nullable(),
  legalName: z.string().nullable(),
  website: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type PropertyGroupRecord = z.infer<typeof propertyGroupRecordSchema>

export const propertyGroupMemberRecordSchema = insertPropertyGroupMemberSchema.extend({
  id: z.string(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  notes: z.string().nullable(),
})

export type PropertyGroupMemberRecord = z.infer<typeof propertyGroupMemberRecordSchema>

export const propertyGroupListResponse = paginatedEnvelope(propertyGroupRecordSchema)
export const propertyGroupSingleResponse = singleEnvelope(propertyGroupRecordSchema)
export const propertyGroupMemberListResponse = paginatedEnvelope(propertyGroupMemberRecordSchema)
export const propertyGroupMemberSingleResponse = singleEnvelope(propertyGroupMemberRecordSchema)
