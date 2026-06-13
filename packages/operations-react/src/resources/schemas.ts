import { z } from "zod"

export const paginatedEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })

export const supplierOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type SupplierOption = z.infer<typeof supplierOptionSchema>

export const productOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type ProductOption = z.infer<typeof productOptionSchema>

export const bookingOptionSchema = z.object({
  id: z.string(),
  bookingNumber: z.string(),
})

export type BookingOption = z.infer<typeof bookingOptionSchema>

export const slotOptionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  dateLocal: z.string(),
  startsAt: z.string(),
})

export type SlotOption = z.infer<typeof slotOptionSchema>

export const ruleOptionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  recurrenceRule: z.string(),
})

export type RuleOption = z.infer<typeof ruleOptionSchema>

export const startTimeOptionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  label: z.string().nullable(),
  startTimeLocal: z.string(),
})

export type StartTimeOption = z.infer<typeof startTimeOptionSchema>

export const resourceKindSchema = z.enum(["guide", "vehicle", "room", "boat", "equipment", "other"])

export const resourceStatusSchema = z.enum([
  "reserved",
  "assigned",
  "released",
  "cancelled",
  "completed",
])

export const allocationModeSchema = z.enum(["shared", "exclusive"])

export const resourceRecordSchema = z.object({
  id: z.string(),
  supplierId: z.string().nullable(),
  kind: resourceKindSchema,
  name: z.string(),
  code: z.string().nullable(),
  capacity: z.number().int().nullable(),
  active: z.boolean(),
  notes: z.string().nullable(),
})

export type ResourceRow = z.infer<typeof resourceRecordSchema>

export const resourceDetailSchema = resourceRecordSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ResourceDetail = z.infer<typeof resourceDetailSchema>

export const resourcePoolRecordSchema = z.object({
  id: z.string(),
  productId: z.string().nullable(),
  kind: resourceKindSchema,
  name: z.string(),
  sharedCapacity: z.number().int().nullable(),
  active: z.boolean(),
  notes: z.string().nullable(),
})

export type ResourcePoolRow = z.infer<typeof resourcePoolRecordSchema>

export const resourcePoolDetailSchema = resourcePoolRecordSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ResourcePoolDetail = z.infer<typeof resourcePoolDetailSchema>

export const resourceAllocationRecordSchema = z.object({
  id: z.string(),
  poolId: z.string(),
  productId: z.string(),
  availabilityRuleId: z.string().nullable(),
  startTimeId: z.string().nullable(),
  quantityRequired: z.number().int(),
  allocationMode: allocationModeSchema,
  priority: z.number().int(),
})

export type ResourceAllocationRow = z.infer<typeof resourceAllocationRecordSchema>

export const resourceAllocationDetailSchema = resourceAllocationRecordSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ResourceAllocationDetail = z.infer<typeof resourceAllocationDetailSchema>

export const resourceSlotAssignmentRecordSchema = z.object({
  id: z.string(),
  slotId: z.string(),
  poolId: z.string().nullable(),
  resourceId: z.string().nullable(),
  bookingId: z.string().nullable(),
  status: resourceStatusSchema,
  assignedBy: z.string().nullable(),
  releasedAt: z.string().nullable(),
  notes: z.string().nullable(),
})

export type ResourceSlotAssignmentRow = z.infer<typeof resourceSlotAssignmentRecordSchema>

export const resourceSlotAssignmentDetailSchema = resourceSlotAssignmentRecordSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ResourceSlotAssignmentDetail = z.infer<typeof resourceSlotAssignmentDetailSchema>

export const resourceCloseoutRecordSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  dateLocal: z.string(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  reason: z.string().nullable(),
  createdBy: z.string().nullable(),
})

export type ResourceCloseoutRow = z.infer<typeof resourceCloseoutRecordSchema>

export const supplierListResponse = paginatedEnvelope(supplierOptionSchema)
export const productListResponse = paginatedEnvelope(productOptionSchema)
export const bookingListResponse = paginatedEnvelope(bookingOptionSchema)
export const slotListResponse = paginatedEnvelope(slotOptionSchema)
export const ruleListResponse = paginatedEnvelope(ruleOptionSchema)
export const startTimeListResponse = paginatedEnvelope(startTimeOptionSchema)
export const resourceListResponse = paginatedEnvelope(resourceRecordSchema)
export const resourcePoolListResponse = paginatedEnvelope(resourcePoolRecordSchema)
export const resourceAllocationListResponse = paginatedEnvelope(resourceAllocationRecordSchema)
export const resourceSlotAssignmentListResponse = paginatedEnvelope(
  resourceSlotAssignmentRecordSchema,
)
export const resourceCloseoutListResponse = paginatedEnvelope(resourceCloseoutRecordSchema)
export const resourceSingleResponse = singleEnvelope(resourceDetailSchema)
export const resourcePoolSingleResponse = singleEnvelope(resourcePoolDetailSchema)
export const resourceAllocationSingleResponse = singleEnvelope(resourceAllocationDetailSchema)
export const resourceSlotAssignmentSingleResponse = singleEnvelope(
  resourceSlotAssignmentDetailSchema,
)
