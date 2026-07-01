import { booleanQueryParam } from "@voyant-travel/schema-kit/query-params"
import { z } from "zod"

import {
  commissionModelSchema,
  commissionRecipientTypeSchema,
  commissionStatusSchema,
  creditNoteStatusSchema,
  invoiceStatusSchema,
  paginationSchema,
  paymentMethodSchema,
  taxScopeSchema,
} from "./validation-shared.js"

const bookingItemTaxLineCoreSchema = z.object({
  code: z.string().max(100).optional().nullable(),
  name: z.string().min(1).max(255),
  jurisdiction: z.string().max(255).optional().nullable(),
  scope: taxScopeSchema.default("excluded"),
  currency: z.string().min(3).max(3),
  amountCents: z.number().int().min(0),
  rateBasisPoints: z.number().int().min(0).optional().nullable(),
  includedInPrice: z.boolean().default(false),
  remittanceParty: z.string().max(255).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
})

export const insertBookingItemTaxLineSchema = bookingItemTaxLineCoreSchema
export const updateBookingItemTaxLineSchema = bookingItemTaxLineCoreSchema.partial()

const bookingItemCommissionShape = {
  channelId: z.string().optional().nullable(),
  recipientType: commissionRecipientTypeSchema,
  commissionModel: commissionModelSchema.default("percentage"),
  currency: z.string().min(3).max(3).optional().nullable(),
  amountCents: z.number().int().min(0).optional().nullable(),
  rateBasisPoints: z.number().int().min(0).optional().nullable(),
  status: commissionStatusSchema.default("pending"),
  payableAt: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}

const bookingItemCommissionCoreSchema = z.object(bookingItemCommissionShape)
const updateBookingItemCommissionCoreSchema = z.object({
  ...bookingItemCommissionShape,
  commissionModel: commissionModelSchema,
  status: commissionStatusSchema,
})

function validateBookingItemCommissionBasis(
  value: {
    commissionModel?: "percentage" | "fixed" | "markup" | "net"
    currency?: string | null
    amountCents?: number | null
    rateBasisPoints?: number | null
    status?: "pending" | "accrued" | "payable" | "paid" | "void"
    paidAt?: string | null
  },
  ctx: z.RefinementCtx,
) {
  if (value.commissionModel === "percentage" && value.rateBasisPoints == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rateBasisPoints"],
      message: "Percentage commissions require rateBasisPoints.",
    })
  }

  if (value.commissionModel === "fixed") {
    if (value.amountCents == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountCents"],
        message: "Fixed commissions require amountCents.",
      })
    }

    if (!value.currency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currency"],
        message: "Fixed commissions require currency.",
      })
    }
  }

  if (value.status === "paid" && !value.paidAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paidAt"],
      message: "Paid commissions require paidAt settlement metadata.",
    })
  }
}

export const insertBookingItemCommissionSchema = bookingItemCommissionCoreSchema.superRefine(
  validateBookingItemCommissionBasis,
)
export const updateBookingItemCommissionSchema = updateBookingItemCommissionCoreSchema
  .partial()
  .superRefine((value, ctx) => {
    if (value.status === "paid" && !value.paidAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paidAt"],
        message: "Paid commissions require paidAt settlement metadata.",
      })
    }
  })

const invoiceCoreSchema = z.object({
  invoiceNumber: z.string().min(1).max(50),
  bookingId: z.string().min(1),
  personId: z.string().optional().nullable(),
  organizationId: z.string().optional().nullable(),
  status: invoiceStatusSchema.default("draft"),
  currency: z.string().min(3).max(3),
  baseCurrency: z.string().min(3).max(3).optional().nullable(),
  fxRateSetId: z.string().optional().nullable(),
  subtotalCents: z.number().int().min(0).default(0),
  baseSubtotalCents: z.number().int().min(0).optional().nullable(),
  taxCents: z.number().int().min(0).default(0),
  baseTaxCents: z.number().int().min(0).optional().nullable(),
  totalCents: z.number().int().min(0).default(0),
  baseTotalCents: z.number().int().min(0).optional().nullable(),
  paidCents: z.number().int().min(0).default(0),
  basePaidCents: z.number().int().min(0).optional().nullable(),
  balanceDueCents: z.number().int().min(0).default(0),
  baseBalanceDueCents: z.number().int().min(0).optional().nullable(),
  commissionPercent: z.number().int().min(0).max(100).optional().nullable(),
  commissionAmountCents: z.number().int().min(0).optional().nullable(),
  issueDate: z.string().min(1),
  dueDate: z.string().min(1),
  notes: z.string().optional().nullable(),
})

export const insertInvoiceSchema = invoiceCoreSchema
export const updateInvoiceSchema = invoiceCoreSchema.partial()
export const voidInvoiceSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
})

export const invoiceListSortFieldSchema = z.enum([
  "invoiceNumber",
  "status",
  "totalCents",
  "paidCents",
  "balanceDueCents",
  "issueDate",
  "dueDate",
  "createdAt",
])

export const invoiceListSortDirSchema = z.enum(["asc", "desc"])

export const invoiceListQuerySchema = z.object({
  status: invoiceStatusSchema.optional(),
  bookingId: z.string().optional(),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  currency: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  search: z.string().optional(),
  sortBy: invoiceListSortFieldSchema.default("createdAt"),
  sortDir: invoiceListSortDirSchema.default("desc"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const invoiceDocumentWaitModeSchema = z.preprocess(
  (value) => {
    if (value === true || value === "true") return "pdf"
    if (value === false || value === "false") return "none"
    return value
  },
  z.enum(["none", "pdf", "any"]),
)

const invoiceDocumentWaitFieldsSchema = z.object({
  wait: invoiceDocumentWaitModeSchema.optional(),
  waitTimeoutMs: z.coerce.number().int().min(0).max(60_000).optional(),
})

const currencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())

const invoiceFromBookingLineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1),
  unitAmountCents: z.number().int().min(0),
  taxRateBps: z.number().int().min(0).optional().nullable(),
  taxAmountCents: z.number().int().min(0).optional().nullable(),
})

const invoiceExternalRefCoreSchema = z.object({
  provider: z.string().min(1).max(100),
  externalId: z.string().max(255).optional().nullable(),
  externalNumber: z.string().max(255).optional().nullable(),
  externalUrl: z.string().max(1000).optional().nullable(),
  status: z.string().max(100).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  syncedAt: z.string().optional().nullable(),
  syncError: z.string().optional().nullable(),
})

export const invoiceFromBookingSchema = z
  .object({
    bookingId: z.string().min(1),
    bookingPaymentScheduleId: z.string().min(1).optional(),
    invoiceNumber: z.string().min(1).max(50).optional(),
    seriesId: z.string().min(1).optional(),
    convertedFromInvoiceId: z.string().min(1).optional().nullable(),
    issueDate: z.string().min(1),
    dueDate: z.string().min(1),
    notes: z.string().optional().nullable(),
    currency: currencyCodeSchema.optional(),
    baseCurrency: currencyCodeSchema.optional(),
    fxRateSetId: z.string().min(1).optional(),
    subtotalCents: z.number().int().min(0).optional(),
    taxCents: z.number().int().min(0).optional(),
    totalCents: z.number().int().min(0).optional(),
    lineItems: z.array(invoiceFromBookingLineItemSchema).min(1).optional(),
    paymentScheduleLineDescriptionFormat: z
      .enum(["schedule_first", "product_first", "product_only"])
      .optional(),
    externalRefs: z.array(invoiceExternalRefCoreSchema).optional(),
    /**
     * Document kind. Defaults to a regular invoice; bank-transfer
     * checkout flows pass `proforma` to issue a placeholder doc until
     * payment lands and a real invoice replaces it.
     */
    invoiceType: z.enum(["invoice", "proforma"]).default("invoice"),
    /**
     * When `true`, downstream e-invoicing plugins (e.g. SmartBill) skip
     * the auto-sync triggered by `invoice.issued` / `invoice.proforma.issued`.
     * The event still fires so other subscribers (ledgers, audit, etc.)
     * see it; only the external-provider subscribers honour this flag.
     */
    skipExternalSync: z.boolean().optional(),
    wait: invoiceDocumentWaitModeSchema.optional(),
    waitTimeoutMs: z.coerce.number().int().min(0).max(60_000).optional(),
  })
  .superRefine((value, ctx) => {
    const providers = new Set<string>()
    for (const [index, ref] of (value.externalRefs ?? []).entries()) {
      if (providers.has(ref.provider)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate invoice external ref provider",
          path: ["externalRefs", index, "provider"],
        })
      }
      providers.add(ref.provider)
    }
  })

const lineItemCoreSchema = z.object({
  bookingItemId: z.string().optional().nullable(),
  bookingPaymentScheduleId: z.string().optional().nullable(),
  description: z.string().min(1).max(1000),
  quantity: z.number().int().min(1).default(1),
  unitPriceCents: z.number().int().min(0),
  totalCents: z.number().int().min(0),
  taxRate: z.number().int().min(0).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
})

export const insertInvoiceLineItemSchema = lineItemCoreSchema
export const updateInvoiceLineItemSchema = lineItemCoreSchema.partial()

const creditNoteCoreSchema = z.object({
  creditNoteNumber: z.string().min(1).max(50),
  status: creditNoteStatusSchema.default("draft"),
  amountCents: z.number().int().min(1),
  currency: z.string().min(3).max(3),
  baseCurrency: z.string().min(3).max(3).optional().nullable(),
  baseAmountCents: z.number().int().min(0).optional().nullable(),
  fxRateSetId: z.string().optional().nullable(),
  reason: z.string().min(1).max(1000),
  notes: z.string().optional().nullable(),
})

export const insertCreditNoteSchema = creditNoteCoreSchema
export const updateCreditNoteSchema = creditNoteCoreSchema.partial()

const creditNoteLineItemCoreSchema = z.object({
  description: z.string().min(1).max(1000),
  quantity: z.number().int().min(1).default(1),
  unitPriceCents: z.number().int().min(0),
  totalCents: z.number().int().min(0),
  sortOrder: z.number().int().min(0).default(0),
})

export const insertCreditNoteLineItemSchema = creditNoteLineItemCoreSchema
export const updateCreditNoteLineItemSchema = creditNoteLineItemCoreSchema.partial()

export const insertFinanceNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})

export const revenueReportQuerySchema = z.object({ from: z.string().min(1), to: z.string().min(1) })
export const agingReportQuerySchema = z.object({ asOf: z.string().optional() })
export const profitabilityQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

const invoiceNumberResetStrategySchema = z.enum(["never", "annual", "monthly"])
const invoiceNumberSeriesScopeSchema = z.enum(["invoice", "proforma", "credit_note"])
const invoiceNumberSeriesCoreSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  prefix: z.string().max(50).default(""),
  separator: z.string().max(10).default(""),
  padLength: z.number().int().min(0).max(20).default(4),
  currentSequence: z.number().int().min(0).default(0),
  resetStrategy: invoiceNumberResetStrategySchema.default("never"),
  resetAt: z.string().optional().nullable(),
  scope: invoiceNumberSeriesScopeSchema.default("invoice"),
  isDefault: z.boolean().default(false),
  externalProvider: z.string().min(1).max(100).optional().nullable(),
  externalConfigKey: z.string().min(1).max(100).optional().nullable(),
  active: z.boolean().default(true),
})
export const insertInvoiceNumberSeriesSchema = invoiceNumberSeriesCoreSchema
export const updateInvoiceNumberSeriesSchema = invoiceNumberSeriesCoreSchema.partial()
export const invoiceNumberSeriesListQuerySchema = paginationSchema.extend({
  scope: invoiceNumberSeriesScopeSchema.optional(),
  active: booleanQueryParam.optional(),
})
export const allocateInvoiceNumberInputSchema = z.object({ seriesId: z.string().min(1) })

const invoiceTemplateBodyFormatSchema = z.enum(["html", "markdown", "lexical_json"])
const invoiceTemplateCoreSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  language: z.string().min(2).max(10).default("en"),
  jurisdiction: z.string().max(10).optional().nullable(),
  bodyFormat: invoiceTemplateBodyFormatSchema.default("html"),
  body: z.string().min(1),
  cssStyles: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})
export const insertInvoiceTemplateSchema = invoiceTemplateCoreSchema
export const updateInvoiceTemplateSchema = invoiceTemplateCoreSchema.partial()
export const invoiceTemplateListQuerySchema = paginationSchema.extend({
  language: z.string().optional(),
  jurisdiction: z.string().optional(),
  active: z.coerce.boolean().optional(),
  search: z.string().optional(),
})

const invoiceRenditionFormatSchema = z.enum(["html", "pdf", "xml", "json"])
const invoiceRenditionStatusSchema = z.enum(["pending", "ready", "failed", "stale"])
const invoiceRenditionCoreSchema = z.object({
  templateId: z.string().optional().nullable(),
  format: invoiceRenditionFormatSchema.default("pdf"),
  status: invoiceRenditionStatusSchema.default("pending"),
  storageKey: z.string().optional().nullable(),
  fileSize: z.number().int().min(0).optional().nullable(),
  checksum: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
  generatedAt: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})
export const insertInvoiceRenditionSchema = invoiceRenditionCoreSchema
export const updateInvoiceRenditionSchema = invoiceRenditionCoreSchema.partial()

const invoiceAttachmentCoreSchema = z.object({
  kind: z.string().min(1).max(50).default("supporting_document"),
  name: z.string().min(1).max(255),
  mimeType: z.string().max(255).optional().nullable(),
  fileSize: z.number().int().min(0).optional().nullable(),
  storageKey: z.string().max(1000).optional().nullable(),
  checksum: z.string().max(255).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const insertInvoiceAttachmentSchema = invoiceAttachmentCoreSchema
export const updateInvoiceAttachmentSchema = invoiceAttachmentCoreSchema.partial()

const taxRegimeCodeSchema = z.enum([
  "standard",
  "reduced",
  "exempt",
  "reverse_charge",
  "margin_scheme_art311",
  "zero_rated",
  "out_of_scope",
  "other",
])
const taxRegimeCoreSchema = z.object({
  code: taxRegimeCodeSchema,
  name: z.string().min(1).max(255),
  jurisdiction: z.string().max(10).optional().nullable(),
  ratePercent: z.number().int().min(0).max(10000).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  legalReference: z.string().max(500).optional().nullable(),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})
export const insertTaxRegimeSchema = taxRegimeCoreSchema
export const updateTaxRegimeSchema = taxRegimeCoreSchema.partial()
export const taxRegimeListQuerySchema = paginationSchema.extend({
  code: taxRegimeCodeSchema.optional(),
  jurisdiction: z.string().optional(),
  active: z.coerce.boolean().optional(),
})

const taxClassLineSchema = z.object({
  regime_id: z.string().min(1),
  applies_to: z.enum(["base", "addon", "accommodation", "all"]),
})

const taxClassCoreSchema = z.object({
  code: z.string().min(1).max(100),
  label: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  defaultRegimeId: z.string().optional().nullable(),
  lines: z.array(taxClassLineSchema).optional().nullable(),
  active: z.boolean().default(true),
})
export const insertTaxClassSchema = taxClassCoreSchema
export const updateTaxClassSchema = taxClassCoreSchema.partial()
export const taxClassListQuerySchema = paginationSchema.extend({
  code: z.string().optional(),
  active: booleanQueryParam.optional(),
})

const taxPolicySideSchema = z.enum(["sell", "buy"])
const taxPolicyAppliesToSchema = z.enum(["base", "addon", "accommodation", "all"])
const taxPolicyProfileCoreSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  jurisdiction: z.string().max(10).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  active: z.boolean().default(true),
})
export const insertTaxPolicyProfileSchema = taxPolicyProfileCoreSchema
export const updateTaxPolicyProfileSchema = taxPolicyProfileCoreSchema.partial()
export const taxPolicyProfileListQuerySchema = paginationSchema.extend({
  code: z.string().optional(),
  jurisdiction: z.string().optional(),
  active: z.coerce.boolean().optional(),
})

const taxPolicyConditionSchema = z.record(z.string(), z.unknown()).optional().nullable()
const taxPolicyRuleCoreSchema = z.object({
  profileId: z.string().min(1),
  side: taxPolicySideSchema.default("sell"),
  priority: z.number().int().min(0).default(100),
  name: z.string().min(1).max(255),
  appliesTo: taxPolicyAppliesToSchema.default("all"),
  condition: taxPolicyConditionSchema,
  taxRegimeId: z.string().min(1),
  active: z.boolean().default(true),
})
export const insertTaxPolicyRuleSchema = taxPolicyRuleCoreSchema
export const updateTaxPolicyRuleSchema = taxPolicyRuleCoreSchema.partial()
export const taxPolicyRuleListQuerySchema = paginationSchema.extend({
  profileId: z.string().optional(),
  side: taxPolicySideSchema.optional(),
  active: z.coerce.boolean().optional(),
})

export const insertInvoiceExternalRefSchema = invoiceExternalRefCoreSchema
export const updateInvoiceExternalRefSchema = invoiceExternalRefCoreSchema.partial()

export const pollInvoiceSettlementInputSchema = z.object({
  provider: z.string().min(1).max(100).optional().nullable(),
  reconcilePayment: z.boolean().default(true),
  paymentMethod: paymentMethodSchema.default("bank_transfer"),
  paymentDate: z.string().optional().nullable(),
  referenceNumber: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const polledInvoiceSettlementProviderResultSchema = z.object({
  provider: z.string(),
  externalRefId: z.string(),
  externalId: z.string().nullable(),
  externalNumber: z.string().nullable(),
  externalUrl: z.string().nullable(),
  status: z.string().nullable(),
  paidAmountCents: z.number().int().nullable(),
  unpaidAmountCents: z.number().int().nullable(),
  syncedAt: z.string().nullable(),
  settledAt: z.string().nullable(),
  createdPaymentId: z.string().nullable(),
  newlyAppliedAmountCents: z.number().int(),
  syncError: z.string().nullable(),
})

export const polledInvoiceSettlementResultSchema = z.object({
  invoiceId: z.string(),
  invoiceStatus: invoiceStatusSchema,
  paidCents: z.number().int(),
  balanceDueCents: z.number().int(),
  results: z.array(polledInvoiceSettlementProviderResultSchema),
})

export const renderInvoiceInputSchema = z.object({
  templateId: z.string().optional().nullable(),
  format: invoiceRenditionFormatSchema.default("pdf"),
  language: z.string().optional().nullable(),
  wait: invoiceDocumentWaitModeSchema.optional(),
  waitTimeoutMs: z.coerce.number().int().min(0).max(60_000).optional(),
})

export const generateInvoiceDocumentInputSchema = renderInvoiceInputSchema.extend({
  replaceExisting: z.boolean().default(true),
  publicDelivery: z.boolean().default(false),
  publicDeliveryTtlSeconds: z
    .number()
    .int()
    .min(1)
    .max(30 * 24 * 60 * 60)
    .optional(),
})

export const invoiceDocumentWaitQuerySchema = invoiceDocumentWaitFieldsSchema

export const generatedInvoiceDocumentResultSchema = z.object({
  invoiceId: z.string(),
  renderedBodyFormat: invoiceTemplateBodyFormatSchema,
  renderedBody: z.string(),
  rendition: z.object({
    id: z.string(),
    invoiceId: z.string(),
    templateId: z.string().nullable(),
    format: invoiceRenditionFormatSchema,
    status: invoiceRenditionStatusSchema,
    storageKey: z.string().nullable(),
    fileSize: z.number().int().nullable(),
    checksum: z.string().nullable(),
    language: z.string().nullable(),
    errorMessage: z.string().nullable(),
    generatedAt: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.string(),
  }),
})

export type GenerateInvoiceDocumentInput = z.infer<typeof generateInvoiceDocumentInputSchema>
export type GeneratedInvoiceDocumentResult = z.infer<typeof generatedInvoiceDocumentResultSchema>
export type PollInvoiceSettlementInput = z.infer<typeof pollInvoiceSettlementInputSchema>
export type PolledInvoiceSettlementResult = z.infer<typeof polledInvoiceSettlementResultSchema>
