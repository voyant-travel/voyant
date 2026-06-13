import { z } from "zod"

// ---------- payment methods ----------

export const paymentMethodBrandSchema = z.enum([
  "visa",
  "mastercard",
  "amex",
  "revolut",
  "bank_transfer",
])

const paymentMethodCoreSchema = z.object({
  brand: paymentMethodBrandSchema,
  last4: z.string().min(2).max(8).nullable().optional(),
  holderName: z.string().nullable().optional(),
  expMonth: z.number().int().min(1).max(12).nullable().optional(),
  expYear: z.number().int().min(2000).max(2100).nullable().optional(),
  processorToken: z.string().min(1),
  isDefault: z.boolean().default(false),
})

export const insertPersonPaymentMethodSchema = paymentMethodCoreSchema
export const updatePersonPaymentMethodSchema = paymentMethodCoreSchema.partial()

export type InsertPersonPaymentMethodInput = z.infer<typeof insertPersonPaymentMethodSchema>
export type UpdatePersonPaymentMethodInput = z.infer<typeof updatePersonPaymentMethodSchema>

export const updateOrganizationNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})
