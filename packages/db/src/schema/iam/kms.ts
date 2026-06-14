import { z } from "zod"

// `kmsEnvelopeSchema` now lives in @voyant-travel/schema-kit (pure). Re-exported here
// to keep the @voyant-travel/db/schema/iam/kms import path stable.
export { type KmsEnvelope, kmsEnvelopeSchema } from "@voyant-travel/schema-kit/kms"

/**
 * Travel document types (plaintext structure before encryption)
 */
export const travelDocumentSchema = z.object({
  type: z.enum(["passport", "national_id", "visa", "drivers_license", "other"]),
  number: z.string(),
  issuingAuthority: z.string().optional(),
  issuingCountry: z.string(),
  nationality: z.string().optional(),
  expiryDate: z.string(), // ISO date string
  issueDate: z.string().optional(),
})

export type TravelDocument = z.infer<typeof travelDocumentSchema>

/**
 * Loyalty program (plaintext structure before encryption)
 */
export const loyaltyProgramSchema = z.object({
  program: z.string(),
  number: z.string(),
  tier: z.string().optional(),
})

export type LoyaltyProgramData = z.infer<typeof loyaltyProgramSchema>

/**
 * Personal insurance policy (plaintext structure before encryption)
 * For global/annual policies owned by the user
 */
export const personalInsurancePolicySchema = z.object({
  providerId: z.string(), // Reference to insurance.providers in db-marketplace
  providerName: z.string(), // Cached name for display without cross-DB lookup
  policyNumber: z.string(),
  type: z.enum(["annual_travel", "medical", "trip_cancellation", "comprehensive", "other"]),
  coverageAmount: z.number().optional(),
  currency: z.string().optional(),
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
  notes: z.string().optional(),
})

export type PersonalInsurancePolicy = z.infer<typeof personalInsurancePolicySchema>
