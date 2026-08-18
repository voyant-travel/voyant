import { z } from "zod"

import {
  communicationChannelSchema,
  communicationDirectionSchema,
  paginationSchema,
} from "./common.js"

// ---------- communication log ----------

export const insertCommunicationLogSchema = z.object({
  organizationId: z.string().nullable().optional(),
  channel: communicationChannelSchema,
  direction: communicationDirectionSchema,
  subject: z.string().max(500).nullable().optional(),
  content: z.string().nullable().optional(),
  sentAt: z.string().datetime({ offset: true }).nullable().optional(),
})

export const communicationListQuerySchema = paginationSchema.extend({
  channel: communicationChannelSchema.optional(),
  direction: communicationDirectionSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

/** Stable keyset pagination for the cross-authority Person timeline. */
export const personTimelineQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  cursor: z.string().min(1).optional(),
  channel: communicationChannelSchema.optional(),
  direction: communicationDirectionSchema.optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
})
