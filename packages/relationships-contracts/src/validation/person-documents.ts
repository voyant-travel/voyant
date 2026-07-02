import { kmsEnvelopeSchema } from "@voyant-travel/schema-kit/kms"
import { z } from "zod"

import { paginationSchema } from "./common.js"

// ---------- person documents ----------

export const personDocumentTypeSchema = z.enum([
  "passport",
  "id_card",
  "driver_license",
  "visa",
  "other",
])

function validateDocumentDateRange(
  data: { issueDate?: string | null; expiryDate?: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.issueDate && data.expiryDate && data.expiryDate < data.issueDate) {
    ctx.addIssue({
      code: "custom",
      path: ["expiryDate"],
      message: "expiryDate must be on or after issueDate",
    })
  }
}

export const personDocumentCoreSchema = z.object({
  type: personDocumentTypeSchema,
  // `z.lazy` for cross-package init-cycle protection — see #501.
  numberEncrypted: z.lazy(() => kmsEnvelopeSchema).optional(),
  issuingAuthority: z.string().nullable().optional(),
  issuingCountry: z.string().nullable().optional(),
  issueDate: z.string().date().nullable().optional(),
  expiryDate: z.string().date().nullable().optional(),
  attachmentId: z.string().nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertPersonDocumentSchema =
  personDocumentCoreSchema.superRefine(validateDocumentDateRange)
export const updatePersonDocumentSchema = personDocumentCoreSchema
  .partial()
  .superRefine(validateDocumentDateRange)
export const personDocumentListQuerySchema = paginationSchema.extend({
  type: personDocumentTypeSchema.optional(),
  expiringBefore: z.string().date().optional(),
})

/**
 * Plaintext input shape for admin-facing create/update endpoints —
 * the route encrypts `number` server-side using the people KMS key
 * before persisting. Operator UIs prefer this over hand-encrypted
 * envelopes.
 */
const personDocumentPlaintextCoreSchema = z.object({
  type: personDocumentTypeSchema,
  number: z.string().max(255).nullable().optional(),
  issuingAuthority: z.string().nullable().optional(),
  issuingCountry: z.string().nullable().optional(),
  issueDate: z.string().date().nullable().optional(),
  expiryDate: z.string().date().nullable().optional(),
  attachmentId: z.string().nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertPersonDocumentFromPlaintextSchema =
  personDocumentPlaintextCoreSchema.superRefine(validateDocumentDateRange)
export const updatePersonDocumentFromPlaintextSchema = personDocumentPlaintextCoreSchema
  .partial()
  .superRefine(validateDocumentDateRange)

/**
 * Plaintext input shape for the four free-text PII slots on
 * `crm.people` (accessibility / dietary / loyalty / insurance). The
 * admin endpoint encrypts each provided value server-side; `null`
 * clears the slot.
 */
export const updatePersonProfilePiiSchema = z
  .object({
    accessibility: z.string().max(4000).nullable().optional(),
    dietary: z.string().max(4000).nullable().optional(),
    loyalty: z.string().max(4000).nullable().optional(),
    insurance: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  })

export type PersonDocumentInput = z.infer<typeof insertPersonDocumentSchema>
export type PersonDocumentUpdate = z.infer<typeof updatePersonDocumentSchema>
export type PersonDocumentPlaintextInput = z.infer<typeof insertPersonDocumentFromPlaintextSchema>
export type PersonDocumentPlaintextUpdate = z.infer<typeof updatePersonDocumentFromPlaintextSchema>
export type UpdatePersonProfilePiiInput = z.infer<typeof updatePersonProfilePiiSchema>
