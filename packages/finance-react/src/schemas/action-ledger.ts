import { z } from "zod"

export const financeActionLedgerActionKindSchema = z.enum([
  "read",
  "create",
  "update",
  "delete",
  "execute",
  "approve",
  "reject",
  "reverse",
  "compensate",
  "duplicate",
])

export const financeActionLedgerStatusSchema = z.enum([
  "requested",
  "awaiting_approval",
  "approved",
  "denied",
  "succeeded",
  "failed",
  "reversed",
  "compensated",
  "expired",
  "cancelled",
  "superseded",
])

export const financeActionLedgerRiskSchema = z.enum(["low", "medium", "high", "critical"])

export const financeActionLedgerPrincipalTypeSchema = z.enum([
  "user",
  "api_key",
  "agent",
  "workflow",
  "system",
])

export const financeActionLedgerEntrySchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  actionName: z.string(),
  actionVersion: z.string(),
  actionKind: financeActionLedgerActionKindSchema,
  status: financeActionLedgerStatusSchema,
  evaluatedRisk: financeActionLedgerRiskSchema,
  actorType: z.string().nullable(),
  principalType: financeActionLedgerPrincipalTypeSchema,
  principalId: z.string(),
  principalSubtype: z.string().nullable(),
  sessionId: z.string().nullable(),
  apiTokenId: z.string().nullable(),
  internalRequest: z.boolean(),
  delegatedByPrincipalType: financeActionLedgerPrincipalTypeSchema.nullable(),
  delegatedByPrincipalId: z.string().nullable(),
  delegationId: z.string().nullable(),
  callerType: z.string().nullable(),
  organizationId: z.string().nullable(),
  routeOrToolName: z.string().nullable(),
  workflowRunId: z.string().nullable(),
  workflowStepId: z.string().nullable(),
  correlationId: z.string().nullable(),
  causationActionId: z.string().nullable(),
  idempotencyScope: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  idempotencyFingerprint: z.string().nullable(),
  targetType: z.string(),
  targetId: z.string(),
  capabilityId: z.string().nullable(),
  capabilityVersion: z.string().nullable(),
  authorizationSource: z.string().nullable(),
  approvalId: z.string().nullable(),
  amendsActionId: z.string().nullable(),
  createdAt: z.string(),
  mutationSummary: z.string().nullable(),
})

export type FinanceActionLedgerEntryRecord = z.infer<typeof financeActionLedgerEntrySchema>

export const financeActionLedgerListResponse = z.object({
  data: z.array(financeActionLedgerEntrySchema),
  pageInfo: z.object({
    nextCursor: z
      .object({
        occurredAt: z.string(),
        id: z.string(),
      })
      .nullable(),
  }),
})

export type FinanceActionLedgerListResponse = z.infer<typeof financeActionLedgerListResponse>
