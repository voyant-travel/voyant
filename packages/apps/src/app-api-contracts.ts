import {
  customFieldDefinitionInputSchema,
  customFieldDefinitionListQuerySchema,
  customFieldValueListQuerySchema,
  updateCustomFieldDefinitionSchema,
  upsertCustomFieldValueSchema,
} from "@voyant-travel/custom-fields"
import type {
  FinanceAppApiExternalReference,
  FinanceAppApiIssuanceDocument,
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

export const appApiTokenExchangeSchema = z
  .object({
    client_id: z.string().min(1),
    client_secret: z.string().optional(),
    viewer_id: z.string().min(1),
    viewer_scopes: z.array(z.string().min(1)),
    contextual_scopes: z.array(z.string().min(1)).optional(),
  })
  .strict()

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
export type AppApiWebhookReplayInput = z.infer<typeof appApiWebhookReplaySchema>
export type AppApiAuditQuery = z.infer<typeof appApiAuditQuerySchema>

export type AppApiFinanceIssuanceDocument = FinanceAppApiIssuanceDocument
export type AppApiFinanceExternalReference = FinanceAppApiExternalReference
