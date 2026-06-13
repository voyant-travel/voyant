import { z } from "zod"
import {
  hasLegalTargetOrCompatibilityRef,
  legalTargetListQueryFieldsSchema,
  legalTargetRefFieldsSchema,
} from "../targets/validation.js"

export const legalTermTypeSchema = z.enum([
  "terms_and_conditions",
  "cancellation",
  "guarantee",
  "payment",
  "pricing",
  "commission",
  "other",
])

export const legalTermAcceptanceStatusSchema = z.enum([
  "not_required",
  "pending",
  "accepted",
  "declined",
])

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

function optionalNullableString(schema: z.ZodString = z.string()) {
  return z
    .union([z.literal("").transform(() => undefined), schema])
    .optional()
    .nullable()
}

const legalTermCoreSchema = z.object({
  contractId: optionalNullableString(),
  policyVersionId: optionalNullableString(),
  ...legalTargetRefFieldsSchema.shape,
  termType: legalTermTypeSchema.default("terms_and_conditions"),
  title: z.string().min(1).max(255),
  body: z.string().min(1),
  language: z.string().max(35).optional().nullable(),
  required: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  acceptanceStatus: legalTermAcceptanceStatusSchema.default("pending"),
  acceptedAt: z.string().optional().nullable(),
  acceptedBy: z.string().max(255).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const insertLegalTermSchema = legalTermCoreSchema.refine(hasLegalTargetOrCompatibilityRef, {
  message: "targetKind/targetId or an explicit legacyTransaction*Id field is required",
  path: ["targetKind"],
})

export const updateLegalTermSchema = legalTermCoreSchema.partial()

export const legalTermListQuerySchema = paginationSchema.extend({
  contractId: z.string().optional(),
  policyVersionId: z.string().optional(),
  ...legalTargetListQueryFieldsSchema.shape,
  termType: legalTermTypeSchema.optional(),
  acceptanceStatus: legalTermAcceptanceStatusSchema.optional(),
})
