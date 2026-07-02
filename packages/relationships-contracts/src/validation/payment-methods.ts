import { z } from "zod"

// ---------- payment methods ----------

export const paymentMethodBrandSchema = z.enum([
  "visa",
  "mastercard",
  "amex",
  "revolut",
  "bank_transfer",
])

const cardPaymentMethodBrandSchema = z.enum(["visa", "mastercard", "amex", "revolut"])

const paymentMethodSharedFields = {
  holderName: z.string().nullable().optional(),
  processorToken: z.string().min(1),
  isDefault: z.boolean().default(false),
}

const cardPaymentMethodSchema = z
  .object({
    ...paymentMethodSharedFields,
    brand: cardPaymentMethodBrandSchema,
    last4: z.string().min(2).max(8),
    expMonth: z.number().int().min(1).max(12),
    expYear: z.number().int().min(2000).max(2100),
  })
  .strict()

const bankTransferPaymentMethodSchema = z
  .object({
    ...paymentMethodSharedFields,
    brand: z.literal("bank_transfer"),
    last4: z.null().optional(),
    expMonth: z.null().optional(),
    expYear: z.null().optional(),
  })
  .strict()

const paymentMethodCoreSchema = z
  .object({
    ...paymentMethodSharedFields,
    brand: paymentMethodBrandSchema,
    last4: z.string().min(2).max(8).nullable().optional(),
    expMonth: z.number().int().min(1).max(12).nullable().optional(),
    expYear: z.number().int().min(2000).max(2100).nullable().optional(),
  })
  .strict()

function validatePartialPaymentMethodFields(
  data: {
    brand?: z.infer<typeof paymentMethodBrandSchema>
    last4?: string | null
    expMonth?: number | null
    expYear?: number | null
  },
  ctx: z.RefinementCtx,
) {
  if (data.brand === "bank_transfer") {
    for (const field of ["last4", "expMonth", "expYear"] as const) {
      if (data[field] != null) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `${field} is only valid for card payment methods`,
        })
      }
    }
    return
  }
}

export const insertPersonPaymentMethodSchema = z.union([
  cardPaymentMethodSchema,
  bankTransferPaymentMethodSchema,
])
export const updatePersonPaymentMethodSchema = paymentMethodCoreSchema
  .partial()
  .superRefine(validatePartialPaymentMethodFields)

export type InsertPersonPaymentMethodInput = z.infer<typeof insertPersonPaymentMethodSchema>
export type UpdatePersonPaymentMethodInput = z.infer<typeof updatePersonPaymentMethodSchema>

export const updateOrganizationNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})
