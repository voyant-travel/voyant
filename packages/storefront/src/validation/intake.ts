import {
  customerSignalKindSchema,
  customerSignalSourceSchema,
  customerSignalStatusSchema,
} from "@voyant-travel/crm-contracts/validation"
import { z } from "zod"

import { languageTagSchema } from "../validation-settings.js"

const boundedRecordSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => JSON.stringify(value).length <= 8000, {
    message: "Object payload must be 8KB or smaller",
  })

const storefrontIntakeTagsSchema = z.array(z.string().trim().min(1).max(64)).max(20).default([])

export const storefrontIntakeConsentSchema = z.object({
  marketing: z.boolean().default(false),
  newsletter: z.boolean().default(false),
  gdpr: z.boolean().default(false),
  scope: z.string().trim().min(1).max(120).nullable().optional(),
  acceptedAt: z.string().datetime().nullable().optional(),
})

export const storefrontLeadContactSchema = z
  .object({
    name: z.string().trim().min(1).max(240).optional(),
    firstName: z.string().trim().min(1).max(120).optional(),
    lastName: z.string().trim().min(1).max(120).optional(),
    email: z.email().max(320).optional(),
    phone: z.string().trim().min(3).max(64).optional(),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Either contact.email or contact.phone is required",
  })

export const storefrontLeadIntakeInputSchema = z.object({
  kind: customerSignalKindSchema.default("inquiry"),
  source: customerSignalSourceSchema.default("website"),
  contact: storefrontLeadContactSchema,
  productId: z.string().trim().min(1).max(160).nullable().optional(),
  optionUnitId: z.string().trim().min(1).max(160).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  tags: storefrontIntakeTagsSchema,
  sourceSubmissionId: z.string().trim().min(1).max(160).nullable().optional(),
  sourceUrl: z.url().nullable().optional(),
  locale: languageTagSchema.optional(),
  payload: boundedRecordSchema.default({}),
  consent: storefrontIntakeConsentSchema.default({
    marketing: false,
    newsletter: false,
    gdpr: false,
  }),
})

export const storefrontNewsletterSubscribeInputSchema = z.object({
  email: z.email().max(320),
  name: z.string().trim().min(1).max(240).optional(),
  firstName: z.string().trim().min(1).max(120).optional(),
  lastName: z.string().trim().min(1).max(120).optional(),
  source: customerSignalSourceSchema.default("website"),
  sourceSubmissionId: z.string().trim().min(1).max(160).nullable().optional(),
  sourceUrl: z.url().nullable().optional(),
  locale: languageTagSchema.optional(),
  tags: storefrontIntakeTagsSchema,
  payload: boundedRecordSchema.default({}),
  consent: storefrontIntakeConsentSchema.extend({ newsletter: z.literal(true) }),
})

export const storefrontIntakeResponseSchema = z.object({
  id: z.string(),
  personId: z.string(),
  kind: customerSignalKindSchema,
  source: customerSignalSourceSchema,
  status: customerSignalStatusSchema,
  duplicate: z.boolean(),
})

export const storefrontNewsletterSubscribeResponseSchema = storefrontIntakeResponseSchema.extend({
  doubleOptIn: z.enum(["not_configured", "requested"]),
})

export type StorefrontIntakeConsent = z.infer<typeof storefrontIntakeConsentSchema>
export type StorefrontLeadContact = z.infer<typeof storefrontLeadContactSchema>
export type StorefrontLeadIntakeInput = z.infer<typeof storefrontLeadIntakeInputSchema>
export type StorefrontNewsletterSubscribeInput = z.infer<
  typeof storefrontNewsletterSubscribeInputSchema
>
export type StorefrontIntakeResponse = z.infer<typeof storefrontIntakeResponseSchema>
export type StorefrontNewsletterSubscribeResponse = z.infer<
  typeof storefrontNewsletterSubscribeResponseSchema
>
