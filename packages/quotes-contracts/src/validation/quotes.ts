import { z } from "zod"

import {
  paginationSchema,
  participantRoleSchema,
  quoteStatusSchema,
  quoteVersionStatusSchema,
} from "./common.js"

export const quoteCoreSchema = z.object({
  title: z.string().min(1),
  personId: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
  pipelineId: z.string(),
  stageId: z.string(),
  ownerId: z.string().nullable().optional(),
  status: quoteStatusSchema.default("open"),
  acceptedVersionId: z.string().nullable().optional(),
  valueAmountCents: z.number().int().nullable().optional(),
  valueCurrency: z.string().nullable().optional(),
  expectedCloseDate: z.string().date().nullable().optional(),
  source: z.string().nullable().optional(),
  sourceRef: z.string().nullable().optional(),
  lostReason: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
})

export const insertQuoteSchema = quoteCoreSchema
export const updateQuoteSchema = quoteCoreSchema.partial()
export const quoteListQuerySchema = paginationSchema.extend({
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  pipelineId: z.string().optional(),
  stageId: z.string().optional(),
  ownerId: z.string().optional(),
  status: quoteStatusSchema.optional(),
  search: z.string().optional(),
})

export const insertQuoteParticipantSchema = z.object({
  personId: z.string(),
  role: participantRoleSchema.default("other"),
  isPrimary: z.boolean().default(false),
})

export const insertQuoteProductSchema = z.object({
  productId: z.string().nullable().optional(),
  supplierServiceId: z.string().nullable().optional(),
  nameSnapshot: z.string().min(1),
  description: z.string().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
  unitPriceAmountCents: z.number().int().nullable().optional(),
  costAmountCents: z.number().int().nullable().optional(),
  currency: z.string().nullable().optional(),
  discountAmountCents: z.number().int().nullable().optional(),
})

export const updateQuoteProductSchema = insertQuoteProductSchema.partial()

export const quoteVersionCoreSchema = z.object({
  quoteId: z.string(),
  label: z.string().nullable().optional(),
  status: quoteVersionStatusSchema.default("draft"),
  supersedesId: z.string().nullable().optional(),
  tripSnapshotId: z.string().nullable().optional(),
  validUntil: z.string().date().nullable().optional(),
  currency: z.string().min(1),
  subtotalAmountCents: z.number().int().default(0),
  taxAmountCents: z.number().int().default(0),
  totalAmountCents: z.number().int().default(0),
  notes: z.string().nullable().optional(),
  sentAt: z.string().datetime().nullable().optional(),
  viewedAt: z.string().datetime().nullable().optional(),
  decidedAt: z.string().datetime().nullable().optional(),
})

export const insertQuoteVersionSchema = quoteVersionCoreSchema
export const updateQuoteVersionSchema = quoteVersionCoreSchema.partial()
export const quoteVersionListQuerySchema = paginationSchema.extend({
  quoteId: z.string().optional(),
  status: quoteVersionStatusSchema.optional(),
})

export const quoteVersionLineCoreSchema = z.object({
  productId: z.string().nullable().optional(),
  supplierServiceId: z.string().nullable().optional(),
  description: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  unitPriceAmountCents: z.number().int().default(0),
  totalAmountCents: z.number().int().default(0),
  currency: z.string().min(1),
})

export const insertQuoteVersionLineSchema = quoteVersionLineCoreSchema
export const updateQuoteVersionLineSchema = quoteVersionLineCoreSchema.partial()

export const applyTripSnapshotQuoteVersionLineSchema = quoteVersionLineCoreSchema.extend({
  componentId: z.string().nullable().optional(),
})

export const applyTripSnapshotToQuoteVersionSchema = z.object({
  tripSnapshotId: z.string().min(1),
  currency: z.string().min(1),
  subtotalAmountCents: z.number().int().default(0),
  taxAmountCents: z.number().int().default(0),
  totalAmountCents: z.number().int().default(0),
  lines: z.array(applyTripSnapshotQuoteVersionLineSchema).default([]),
})

export const sendQuoteVersionSchema = z.object({
  validUntil: z.string().date().nullable().optional(),
})

export const acceptQuoteVersionSchema = z.object({})

export const declineQuoteVersionSchema = z.object({})

export const expireQuoteVersionsSchema = z.object({
  now: z.string().datetime().optional(),
})
