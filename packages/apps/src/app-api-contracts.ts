import {
  customFieldDefinitionInputSchema,
  customFieldDefinitionListQuerySchema,
  customFieldValueListQuerySchema,
  updateCustomFieldDefinitionSchema,
  upsertCustomFieldValueSchema,
} from "@voyant-travel/custom-fields"
import type {
  FinanceAppApiExternalReference,
  FinanceAppApiExternalSyncState,
  FinanceAppApiIssuanceDocument,
  FinanceAppApiPdfArtifact,
} from "@voyant-travel/finance-contracts/app-api"
import { z } from "zod"

export const APP_API_VERSION = "2026-07-01"

export const appApiVersionHeader = "voyant-app-api-version"

export const appApiEntityReadQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
})

export const appApiFinanceDocumentQuerySchema = z.object({
  invoiceId: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
})

export const appApiFinanceActionSchema = z
  .object({
    action: z.enum(["issue", "retry", "reconcile"]),
    invoiceId: z.string().min(1).optional(),
    bookingId: z.string().min(1).optional(),
    approvalId: z.string().min(1).optional(),
    idempotencyKey: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()

export const appApiFinanceExternalReferenceSchema = z
  .object({
    externalId: z.string().min(1).max(500).nullable(),
    externalNumber: z.string().min(1).max(500).nullable(),
    externalUrl: z
      .string()
      .url()
      .max(2_048)
      .refine((value) => new URL(value).protocol === "https:", "External URL must use HTTPS.")
      .nullable(),
    status: z.string().min(1).max(100).nullable(),
    metadata: z
      .record(z.string().min(1).max(100), z.unknown())
      .refine((value) => JSON.stringify(value).length <= 16_384, "Metadata is too large.")
      .nullable(),
    syncedAt: z.string().datetime().nullable(),
    syncError: z.string().max(4_000).nullable(),
  })
  .strict()

export const appApiFinanceExternalReferenceUpsertSchema = z
  .object({
    reference: appApiFinanceExternalReferenceSchema,
    allocation: z
      .object({ invoiceNumber: z.string().trim().min(1).max(500) })
      .strict()
      .optional(),
  })
  .strict()

export const appApiFinancePdfArtifactHeadersSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(200),
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine(
        (value) =>
          [...value].every((character) => {
            const code = character.charCodeAt(0)
            return code >= 32 && code !== 127 && character !== "/" && character !== "\\"
          }),
        "Invalid artifact file name.",
      ),
  })
  .strict()

const appApiFinanceExternalSyncErrorSchema = z
  .object({
    code: z.string().trim().min(1).max(100),
    message: z.string().trim().min(1).max(2_000),
  })
  .strict()

export const appApiFinanceExternalSyncStateSchema = z
  .object({
    operationId: z.string().trim().min(1).max(200),
    status: z.enum(["succeeded", "retryable_failure", "terminal_failure"]),
    occurredAt: z.string().datetime(),
    error: appApiFinanceExternalSyncErrorSchema.nullable().default(null),
    metadata: z
      .record(z.string().trim().min(1).max(100), z.unknown())
      .refine((value) => JSON.stringify(value).length <= 16_384, "Metadata is too large.")
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "succeeded" && value.error) {
      context.addIssue({
        code: "custom",
        message: "Successful sync state cannot include an error.",
      })
    }
    if (value.status !== "succeeded" && !value.error) {
      context.addIssue({ code: "custom", message: "Failed sync state requires an error." })
    }
  })

export const appApiWebhookReplaySchema = z
  .object({
    deliveryId: z.string().min(1),
    signingKeyId: z.string().min(1),
    signingSecret: z.string().min(1),
  })
  .strict()

export const appApiAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
})

export const appApiDefinitionNamespaceSchema = z
  .object({
    namespace: z.string().optional(),
  })
  .strict()

export {
  customFieldDefinitionInputSchema as appApiCustomFieldDefinitionCreateSchema,
  customFieldDefinitionListQuerySchema as appApiCustomFieldDefinitionListQuerySchema,
  customFieldValueListQuerySchema as appApiCustomFieldValueListQuerySchema,
  updateCustomFieldDefinitionSchema as appApiCustomFieldDefinitionUpdateSchema,
  upsertCustomFieldValueSchema as appApiCustomFieldValueUpsertSchema,
}

export type AppApiEntityReadQuery = z.infer<typeof appApiEntityReadQuerySchema>
export type AppApiFinanceDocumentQuery = z.infer<typeof appApiFinanceDocumentQuerySchema>
export type AppApiFinanceActionInput = z.infer<typeof appApiFinanceActionSchema>
export type AppApiFinanceExternalReferenceUpsertInput = z.infer<
  typeof appApiFinanceExternalReferenceUpsertSchema
>
export type AppApiFinancePdfArtifactHeaders = z.infer<typeof appApiFinancePdfArtifactHeadersSchema>
export type AppApiFinanceExternalSyncStateInput = z.infer<
  typeof appApiFinanceExternalSyncStateSchema
>
export type AppApiWebhookReplayInput = z.infer<typeof appApiWebhookReplaySchema>
export type AppApiAuditQuery = z.infer<typeof appApiAuditQuerySchema>

export type AppApiFinanceIssuanceDocument = FinanceAppApiIssuanceDocument
export type AppApiFinanceExternalReference = FinanceAppApiExternalReference
export type AppApiFinancePdfArtifact = FinanceAppApiPdfArtifact & { documentUrl: string }
export type AppApiFinanceExternalSyncState = FinanceAppApiExternalSyncState
