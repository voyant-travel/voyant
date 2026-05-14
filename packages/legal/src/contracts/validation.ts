import { validateStructuredTemplateSyntax } from "@voyantjs/utils/template-renderer"
import { z } from "zod"

export const contractScopeSchema = z.enum(["customer", "supplier", "partner", "channel", "other"])

export const contractStatusSchema = z.enum([
  "draft",
  "issued",
  "sent",
  "signed",
  "executed",
  "expired",
  "void",
])

export const contractStageHistoryEntrySchema = z.object({
  stage: contractStatusSchema,
  previousStage: contractStatusSchema.nullable(),
  transition: z.enum(["created", "issued", "sent", "signed", "executed", "voided"]),
  enteredAt: z.string(),
  actorId: z.string().nullable().optional(),
})

export const contractSignatureMethodSchema = z.enum(["manual", "electronic", "docusign", "other"])

export const contractNumberResetStrategySchema = z.enum(["never", "annual", "monthly"])

export const contractBodyFormatSchema = z.enum(["markdown", "html", "lexical_json"])

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const contractTemplateBodySchema = z
  .string()
  .min(1)
  .superRefine((body, ctx) => {
    for (const issue of validateStructuredTemplateSyntax(body, "html")) {
      ctx.addIssue({
        code: "custom",
        message: `invalid Liquid syntax: ${issue.message}`,
      })
    }
  })

// ---------- contract templates ----------

const contractTemplateCoreSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  scope: contractScopeSchema,
  language: z.string().min(2).max(10).default("en"),
  description: z.string().max(2000).optional().nullable(),
  body: contractTemplateBodySchema,
  variableSchema: z.record(z.string(), z.unknown()).optional().nullable(),
  channelId: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
})

export const insertContractTemplateSchema = contractTemplateCoreSchema
export const updateContractTemplateSchema = contractTemplateCoreSchema.partial()

export const contractTemplateListQuerySchema = paginationSchema.extend({
  scope: contractScopeSchema.optional(),
  language: z.string().optional(),
  channelId: z.string().optional(),
  active: z.coerce.boolean().optional(),
  search: z.string().optional(),
})

export const contractTemplateDefaultQuerySchema = z.object({
  scope: contractScopeSchema.default("customer"),
  channelId: z.string().optional(),
  language: z.string().min(2).max(10).optional(),
  fallbackLanguages: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    ),
})

// ---------- contract template versions ----------

export const insertContractTemplateVersionSchema = z.object({
  body: contractTemplateBodySchema,
  variableSchema: z.record(z.string(), z.unknown()).optional().nullable(),
  changelog: z.string().max(2000).optional().nullable(),
  createdBy: z.string().max(255).optional().nullable(),
})

// ---------- contract number series ----------

const contractNumberSeriesCoreSchema = z.object({
  name: z.string().min(1).max(255),
  prefix: z.string().min(1).max(20),
  separator: z.string().max(5).default(""),
  padLength: z.number().int().min(0).max(12).default(4),
  resetStrategy: contractNumberResetStrategySchema.default("never"),
  scope: contractScopeSchema.default("customer"),
  active: z.boolean().default(true),
})

export const insertContractNumberSeriesSchema = contractNumberSeriesCoreSchema
export const updateContractNumberSeriesSchema = contractNumberSeriesCoreSchema.partial()

// ---------- contracts ----------

const contractCoreSchema = z.object({
  scope: contractScopeSchema,
  status: contractStatusSchema.default("draft"),
  title: z.string().min(1).max(500),
  templateVersionId: z.string().optional().nullable(),
  seriesId: z.string().optional().nullable(),
  personId: z.string().optional().nullable(),
  organizationId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  channelId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  language: z.string().min(2).max(10).default("en"),
  variables: z.record(z.string(), z.unknown()).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const insertContractSchema = contractCoreSchema
export const updateContractSchema = contractCoreSchema
  .omit({ status: true, language: true })
  .extend({
    language: z.string().min(2).max(10).optional(),
  })
  .partial()

export const contractListQuerySchema = paginationSchema.extend({
  scope: contractScopeSchema.optional(),
  status: contractStatusSchema.optional(),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  supplierId: z.string().optional(),
  bookingId: z.string().optional(),
  orderId: z.string().optional(),
  search: z.string().optional(),
})

export const renderTemplateInputSchema = z.object({
  variables: z.record(z.string(), z.unknown()),
  body: z.string().optional(),
})

export const publicRenderTemplatePreviewInputSchema = z.object({
  variables: z.record(z.string(), z.unknown()),
})

export const generateContractDocumentInputSchema = z.object({
  kind: z.string().min(1).max(50).default("document"),
  replaceExisting: z.boolean().default(true),
  issueIfDraft: z.boolean().default(true),
})

export const generatedContractDocumentAttachmentSchema = z.object({
  id: z.string(),
  contractId: z.string(),
  kind: z.string(),
  name: z.string(),
  mimeType: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  storageKey: z.string().nullable(),
  checksum: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
})

export const generatedContractDocumentResultSchema = z.object({
  contractId: z.string(),
  contractStatus: contractStatusSchema,
  renderedBodyFormat: contractBodyFormatSchema,
  renderedBody: z.string(),
  attachment: generatedContractDocumentAttachmentSchema,
})

// ---------- contract signatures ----------

const contractSignatureCoreSchema = z.object({
  signerName: z.string().min(1).max(255),
  signerEmail: z.string().email().optional().nullable(),
  signerRole: z.string().max(255).optional().nullable(),
  personId: z.string().optional().nullable(),
  method: contractSignatureMethodSchema.default("manual"),
  provider: z.string().max(255).optional().nullable(),
  externalReference: z.string().max(255).optional().nullable(),
  signatureData: z.string().optional().nullable(),
  ipAddress: z.string().max(64).optional().nullable(),
  userAgent: z.string().max(500).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const insertContractSignatureSchema = contractSignatureCoreSchema

// ---------- contract attachments ----------

const contractAttachmentCoreSchema = z.object({
  kind: z.string().min(1).max(50).default("appendix"),
  name: z.string().min(1).max(255),
  mimeType: z.string().max(255).optional().nullable(),
  fileSize: z.number().int().min(0).optional().nullable(),
  storageKey: z.string().max(1000).optional().nullable(),
  checksum: z.string().max(255).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const insertContractAttachmentSchema = contractAttachmentCoreSchema
export const updateContractAttachmentSchema = contractAttachmentCoreSchema.partial()

export type GenerateContractDocumentInput = z.infer<typeof generateContractDocumentInputSchema>
