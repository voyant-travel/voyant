import { z } from "zod"

import {
  activityLinkRoleSchema,
  activityStatusSchema,
  activityTypeSchema,
  entityTypeSchema,
  paginationSchema,
} from "./common.js"

export const activityCoreSchema = z.object({
  subject: z.string().min(1),
  type: activityTypeSchema,
  ownerId: z.string().nullable().optional(),
  status: activityStatusSchema.default("planned"),
  dueAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
})

export const insertActivitySchema = activityCoreSchema
export const updateActivitySchema = activityCoreSchema.partial()
export const activityListQuerySchema = paginationSchema.extend({
  ownerId: z.string().optional(),
  status: activityStatusSchema.optional(),
  type: activityTypeSchema.optional(),
  entityType: entityTypeSchema.optional(),
  entityId: z.string().optional(),
  search: z.string().optional(),
})

export const insertActivityLinkSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string(),
  role: activityLinkRoleSchema.default("related"),
})

export const insertActivityParticipantSchema = z.object({
  personId: z.string(),
  isPrimary: z.boolean().default(false),
})
