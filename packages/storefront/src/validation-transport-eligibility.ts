import { z } from "zod"

const countryCodeSchema = z
  .string()
  .trim()
  .length(2)
  .transform((value) => value.toUpperCase())

export const storefrontTravelDocumentTypeSchema = z.enum([
  "passport",
  "id_card",
  "residence_permit",
  "visa",
  "minor_consent",
  "other",
])

export const storefrontRequiredDocumentTypeSchema = z.enum([
  "none",
  "passport",
  "id_card",
  "passport_or_id_card",
])

export const storefrontTransportEligibilitySeveritySchema = z.enum(["blocking", "warning"])

export const storefrontTransportEligibilityRuleSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    productId: z.string().trim().min(1).optional().nullable(),
    departureId: z.string().trim().min(1).optional().nullable(),
    destinationCountries: z.array(countryCodeSchema).min(1),
    nationalityCountries: z.array(countryCodeSchema).default([]),
    requiredDocumentType: storefrontRequiredDocumentTypeSchema.default("passport"),
    minValidityDaysAfterReturn: z.number().int().min(0).default(0),
    minAge: z.number().int().min(0).optional().nullable(),
    maxAge: z.number().int().min(0).optional().nullable(),
    visaRequired: z.boolean().default(false),
    minorConsentRequired: z.boolean().default(false),
    severity: storefrontTransportEligibilitySeveritySchema.default("blocking"),
    message: z.string().trim().min(1).optional().nullable(),
  })
  .refine((rule) => rule.minAge == null || rule.maxAge == null || rule.minAge <= rule.maxAge, {
    message: "minAge must be less than or equal to maxAge",
    path: ["maxAge"],
  })

export const storefrontTransportEligibilityDocumentInputSchema = z.object({
  type: storefrontTravelDocumentTypeSchema,
  issuingCountry: countryCodeSchema.optional().nullable(),
  expiresOn: z.string().date().optional().nullable(),
})

export const storefrontTransportEligibilityTravelerInputSchema = z.object({
  travelerRef: z.string().trim().min(1),
  nationalityCountry: countryCodeSchema.optional().nullable(),
  dateOfBirth: z.string().date().optional().nullable(),
  documents: z.array(storefrontTransportEligibilityDocumentInputSchema).default([]),
  hasVisa: z.boolean().default(false),
  travelingWithGuardian: z.boolean().default(false),
  hasMinorConsent: z.boolean().default(false),
})

export const storefrontTransportEligibilityInputSchema = z.object({
  travelStartsOn: z.string().date().optional().nullable(),
  travelEndsOn: z.string().date().optional().nullable(),
  travelers: z.array(storefrontTransportEligibilityTravelerInputSchema).min(1),
})

export const storefrontTransportEligibilityIssueCodeSchema = z.enum([
  "date_of_birth_required",
  "document_required",
  "document_expiry_required",
  "document_validity",
  "nationality_required",
  "visa_required",
  "minor_consent_required",
  "travel_dates_required",
])

export const storefrontTransportEligibilityIssueSchema = z.object({
  code: storefrontTransportEligibilityIssueCodeSchema,
  severity: storefrontTransportEligibilitySeveritySchema,
  message: z.string(),
  travelerRef: z.string(),
  ruleId: z.string(),
  destinationCountries: z.array(countryCodeSchema),
  requiredDocumentType: storefrontRequiredDocumentTypeSchema,
})

export const storefrontTransportEligibilityTravelerResultSchema = z.object({
  travelerRef: z.string(),
  eligible: z.boolean(),
  matchedRuleIds: z.array(z.string()),
  blockingIssues: z.array(storefrontTransportEligibilityIssueSchema),
  warnings: z.array(storefrontTransportEligibilityIssueSchema),
})

export const storefrontTransportEligibilityResultSchema = z.object({
  departureId: z.string(),
  productId: z.string().nullable(),
  travelStartsOn: z.string().nullable(),
  travelEndsOn: z.string().nullable(),
  eligible: z.boolean(),
  blockingIssues: z.array(storefrontTransportEligibilityIssueSchema),
  warnings: z.array(storefrontTransportEligibilityIssueSchema),
  travelers: z.array(storefrontTransportEligibilityTravelerResultSchema),
})

export type StorefrontTransportEligibilityInput = z.infer<
  typeof storefrontTransportEligibilityInputSchema
>
export type StorefrontTransportEligibilityRule = z.infer<
  typeof storefrontTransportEligibilityRuleSchema
>
export type StorefrontTransportEligibilityRuleInput = z.input<
  typeof storefrontTransportEligibilityRuleSchema
>
export type StorefrontTransportEligibilityIssue = z.infer<
  typeof storefrontTransportEligibilityIssueSchema
>
export type StorefrontTransportEligibilityResult = z.infer<
  typeof storefrontTransportEligibilityResultSchema
>
