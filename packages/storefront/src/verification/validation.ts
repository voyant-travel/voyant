import { z } from "zod"

export const storefrontVerificationChannelSchema = z.enum(["email", "sms"])
export const storefrontVerificationStatusSchema = z.enum([
  "pending",
  "verified",
  "expired",
  "failed",
  "cancelled",
])

const purposeSchema = z.string().trim().min(1).max(100).default("contact_confirmation")
const metadataSchema = z.record(z.string(), z.unknown()).optional().nullable()

export const startEmailVerificationChallengeSchema = z.object({
  email: z.email(),
  purpose: purposeSchema,
  locale: z.string().trim().min(2).max(16).optional().nullable(),
  metadata: metadataSchema,
})

export const startSmsVerificationChallengeSchema = z.object({
  phone: z.string().trim().min(6).max(32),
  purpose: purposeSchema,
  locale: z.string().trim().min(2).max(16).optional().nullable(),
  metadata: metadataSchema,
})

export const confirmEmailVerificationChallengeSchema = z.object({
  email: z.email(),
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/),
  purpose: purposeSchema,
})

export const confirmSmsVerificationChallengeSchema = z.object({
  phone: z.string().trim().min(6).max(32),
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/),
  purpose: purposeSchema,
})

export const storefrontVerificationChallengeRecordSchema = z.object({
  id: z.string(),
  channel: storefrontVerificationChannelSchema,
  destination: z.string(),
  purpose: z.string(),
  status: storefrontVerificationStatusSchema,
  expiresAt: z.date(),
  verifiedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const storefrontVerificationStartResultSchema = storefrontVerificationChallengeRecordSchema

export const storefrontVerificationConfirmResultSchema =
  storefrontVerificationChallengeRecordSchema.extend({
    status: z.literal("verified"),
  })

export type StorefrontVerificationChannel = z.infer<typeof storefrontVerificationChannelSchema>
export type StorefrontVerificationStatus = z.infer<typeof storefrontVerificationStatusSchema>
export type StartEmailVerificationChallengeInput = z.infer<
  typeof startEmailVerificationChallengeSchema
>
export type StartSmsVerificationChallengeInput = z.infer<typeof startSmsVerificationChallengeSchema>
export type ConfirmEmailVerificationChallengeInput = z.infer<
  typeof confirmEmailVerificationChallengeSchema
>
export type ConfirmSmsVerificationChallengeInput = z.infer<
  typeof confirmSmsVerificationChallengeSchema
>
export type StorefrontVerificationChallengeRecord = z.infer<
  typeof storefrontVerificationChallengeRecordSchema
>
export type StorefrontVerificationStartResult = z.infer<
  typeof storefrontVerificationStartResultSchema
>
export type StorefrontVerificationConfirmResult = z.infer<
  typeof storefrontVerificationConfirmResultSchema
>
