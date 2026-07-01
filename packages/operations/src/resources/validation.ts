import { booleanQueryParam } from "@voyant-travel/db/helpers"
import { z } from "zod"

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const isoDateSchema = z.string().date()
const isoDateTimeSchema = z.string().datetime()

export const resourceKindSchema = z.enum(["guide", "vehicle", "room", "boat", "equipment", "other"])
export const resourceAllocationModeSchema = z.enum(["shared", "exclusive"])
export const resourceAssignmentStatusSchema = z.enum([
  "reserved",
  "assigned",
  "released",
  "cancelled",
  "completed",
])

export const resourceCoreSchema = z.object({
  supplierId: z.string().nullable().optional(),
  facilityId: z.string().nullable().optional(),
  kind: resourceKindSchema,
  name: z.string().min(1),
  code: z.string().nullable().optional(),
  capacity: z.number().int().min(0).nullable().optional(),
  active: z.boolean(),
  notes: z.string().nullable().optional(),
})

export const insertResourceSchema = resourceCoreSchema.extend({
  active: resourceCoreSchema.shape.active.default(true),
})
export const updateResourceSchema = resourceCoreSchema.partial()
export const resourceListQuerySchema = paginationSchema.extend({
  supplierId: z.string().optional(),
  facilityId: z.string().optional(),
  kind: resourceKindSchema.optional(),
  active: booleanQueryParam.optional(),
})

export const resourcePoolCoreSchema = z.object({
  productId: z.string().nullable().optional(),
  kind: resourceKindSchema,
  name: z.string().min(1),
  sharedCapacity: z.number().int().min(0).nullable().optional(),
  active: z.boolean(),
  notes: z.string().nullable().optional(),
})

export const insertResourcePoolSchema = resourcePoolCoreSchema.extend({
  active: resourcePoolCoreSchema.shape.active.default(true),
})
export const updateResourcePoolSchema = resourcePoolCoreSchema.partial()
export const resourcePoolListQuerySchema = paginationSchema.extend({
  productId: z.string().optional(),
  kind: resourceKindSchema.optional(),
  active: booleanQueryParam.optional(),
})

export const insertResourcePoolMemberSchema = z.object({
  poolId: z.string(),
  resourceId: z.string(),
})

export const resourcePoolMemberListQuerySchema = paginationSchema.extend({
  poolId: z.string().optional(),
  resourceId: z.string().optional(),
})

export const resourceRequirementCoreSchema = z.object({
  poolId: z.string(),
  productId: z.string(),
  availabilityRuleId: z.string().nullable().optional(),
  startTimeId: z.string().nullable().optional(),
  quantityRequired: z.number().int().min(1),
  allocationMode: resourceAllocationModeSchema,
  priority: z.number().int(),
})

export const insertResourceRequirementSchema = resourceRequirementCoreSchema.extend({
  quantityRequired: resourceRequirementCoreSchema.shape.quantityRequired.default(1),
  allocationMode: resourceRequirementCoreSchema.shape.allocationMode.default("shared"),
  priority: resourceRequirementCoreSchema.shape.priority.default(0),
})
export const updateResourceRequirementSchema = resourceRequirementCoreSchema.partial()
export const resourceRequirementListQuerySchema = paginationSchema.extend({
  poolId: z.string().optional(),
  productId: z.string().optional(),
  availabilityRuleId: z.string().optional(),
  startTimeId: z.string().optional(),
})

export const insertResourceAllocationSchema = insertResourceRequirementSchema
export const updateResourceAllocationSchema = updateResourceRequirementSchema
export const resourceAllocationListQuerySchema = resourceRequirementListQuerySchema

export const resourceSlotAssignmentCoreSchema = z.object({
  slotId: z.string(),
  poolId: z.string().nullable().optional(),
  resourceId: z.string().nullable().optional(),
  bookingId: z.string().nullable().optional(),
  status: resourceAssignmentStatusSchema,
  assignedAt: isoDateTimeSchema.optional(),
  assignedBy: z.string().nullable().optional(),
  releasedAt: isoDateTimeSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
})

function validateSlotAssignmentLifecycle(
  data: z.infer<typeof resourceSlotAssignmentCoreSchema>,
  ctx: z.RefinementCtx,
) {
  if (!data.poolId && !data.resourceId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either poolId or resourceId is required",
      path: ["resourceId"],
    })
  }

  const releasedAt = data.releasedAt ? new Date(data.releasedAt) : null
  const assignedAt = data.assignedAt ? new Date(data.assignedAt) : null
  if (releasedAt && assignedAt && releasedAt < assignedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "releasedAt must be after assignedAt",
      path: ["releasedAt"],
    })
  }

  if (data.status === "released" && !releasedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "releasedAt is required when status is released",
      path: ["releasedAt"],
    })
  }

  if (data.status !== "released" && releasedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "releasedAt is only allowed when status is released",
      path: ["releasedAt"],
    })
  }
}

export const insertResourceSlotAssignmentSchema = resourceSlotAssignmentCoreSchema
  .extend({
    status: resourceSlotAssignmentCoreSchema.shape.status.default("reserved"),
  })
  .superRefine(validateSlotAssignmentLifecycle)
export const updateResourceSlotAssignmentSchema = resourceSlotAssignmentCoreSchema.partial()
export const resourceSlotAssignmentListQuerySchema = paginationSchema.extend({
  slotId: z.string().optional(),
  poolId: z.string().optional(),
  resourceId: z.string().optional(),
  bookingId: z.string().optional(),
  status: resourceAssignmentStatusSchema.optional(),
})

export const resourceCloseoutCoreSchema = z.object({
  resourceId: z.string(),
  dateLocal: isoDateSchema,
  startsAt: isoDateTimeSchema.nullable().optional(),
  endsAt: isoDateTimeSchema.nullable().optional(),
  reason: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
})

export const insertResourceCloseoutSchema = resourceCloseoutCoreSchema
export const updateResourceCloseoutSchema = resourceCloseoutCoreSchema.partial()
export const resourceCloseoutListQuerySchema = paginationSchema.extend({
  resourceId: z.string().optional(),
  dateLocal: isoDateSchema.optional(),
})
