import { z } from "zod"

export const sourceConnectionTruthModeValues = [
  "native",
  "mirrored",
  "external-live",
  "hybrid",
] as const

export const sourceConnectionStatusValues = [
  "draft",
  "active",
  "paused",
  "degraded",
  "disconnecting",
  "disconnected",
] as const

export const sourceConnectionHealthStatusValues = [
  "unknown",
  "healthy",
  "degraded",
  "failing",
] as const

export const sourceConnectionCapabilityStateValues = [
  "supported",
  "unsupported",
  "unknown",
] as const

const sourceKindSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$/i, {
    message: "sourceKind must use '<family>:<source>' form, for example 'crm:hubspot'",
  })

const nonEmptyTrimmedString = z.string().trim().min(1)
const optionalTrimmedString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .nullable()
  .transform((value) => value ?? null)
const jsonRecordSchema = z.record(z.string(), z.unknown())

export const sourceConnectionCapabilityDeclarationSchema = z.object({
  capability: nonEmptyTrimmedString.max(120),
  state: z.enum(sourceConnectionCapabilityStateValues),
  notes: z.string().trim().min(1).max(500).optional(),
})

export const sourceConnectionListQuerySchema = z.object({
  sourceKind: sourceKindSchema.optional(),
  capabilityScope: nonEmptyTrimmedString.max(80).optional(),
  sourceOfTruthMode: z.enum(sourceConnectionTruthModeValues).optional(),
  status: z.enum(sourceConnectionStatusValues).optional(),
  healthStatus: z.enum(sourceConnectionHealthStatusValues).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export const createSourceConnectionDraftSchema = z.object({
  sourceKind: sourceKindSchema,
  displayName: nonEmptyTrimmedString.max(160),
  capabilityScope: nonEmptyTrimmedString.max(80),
  sourceOfTruthMode: z.enum(sourceConnectionTruthModeValues),
  credentialRef: optionalTrimmedString,
  credentialRefVersion: optionalTrimmedString,
  sourceAccountId: optionalTrimmedString,
  grantedScopes: z.array(nonEmptyTrimmedString.max(160)).default([]),
  capabilities: z.array(sourceConnectionCapabilityDeclarationSchema).default([]),
  rateLimitState: jsonRecordSchema.optional().nullable().default(null),
  cursorState: jsonRecordSchema.optional().nullable().default(null),
  metadata: jsonRecordSchema.optional().nullable().default(null),
})

export const pauseSourceConnectionSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
})

export const resumeSourceConnectionSchema = z.object({})

export const disconnectSourceConnectionSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
  disconnectBehavior: z.array(nonEmptyTrimmedString.max(160)).default([]),
})

export type SourceConnectionListQuery = z.infer<typeof sourceConnectionListQuerySchema>
export type CreateSourceConnectionDraftInput = z.infer<typeof createSourceConnectionDraftSchema>
export type PauseSourceConnectionInput = z.infer<typeof pauseSourceConnectionSchema>
export type ResumeSourceConnectionInput = z.infer<typeof resumeSourceConnectionSchema>
export type DisconnectSourceConnectionInput = z.infer<typeof disconnectSourceConnectionSchema>
