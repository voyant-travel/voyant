import {
  publicBookingFinanceDocumentsSchema,
  publicBookingFinancePaymentsSchema,
  publicBookingPaymentOptionsSchema,
  publicFinanceBookingDocumentSchema,
  publicFinanceBookingPaymentSchema,
  publicFinanceDocumentLookupQuerySchema,
  publicFinanceDocumentLookupSchema,
  publicPaymentOptionsQuerySchema,
  publicPaymentSessionSchema,
  publicStartPaymentSessionSchema,
  publicValidateVoucherSchema,
  publicVoucherValidationSchema,
} from "@voyantjs/finance/public-validation"
import { z } from "zod"

export const paginatedEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })
export const arrayEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.array(item) })
export const successEnvelope = z.object({ success: z.boolean() })

export const invoiceStatusSchema = z.enum([
  "draft",
  "pending_external_allocation",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "void",
])

export const paymentStatusSchema = z.enum(["pending", "completed", "failed", "refunded"])
export type PaymentStatus = z.infer<typeof paymentStatusSchema>

// Mirrors the backend's `paymentMethodSchema` from
// `@voyantjs/finance/validation-shared`. Kept inline rather than
// re-imported from `@voyantjs/finance` so the browser bundle doesn't
// drag in drizzle and the rest of the server-only package.
export const paymentMethodSchema = z.enum([
  "bank_transfer",
  "credit_card",
  "debit_card",
  "cash",
  "cheque",
  "wallet",
  "direct_bill",
  "voucher",
  "other",
])
export type PaymentMethod = z.infer<typeof paymentMethodSchema>
export const creditNoteStatusSchema = z.enum(["draft", "issued", "applied"])

export const invoiceTypeSchema = z.enum(["invoice", "proforma", "credit_note"])

export const invoiceNumberResetStrategySchema = z.enum(["never", "annual", "monthly"])
export type InvoiceNumberResetStrategy = z.infer<typeof invoiceNumberResetStrategySchema>

export const invoiceNumberSeriesScopeSchema = invoiceTypeSchema
export type InvoiceNumberSeriesScope = z.infer<typeof invoiceNumberSeriesScopeSchema>

export const invoiceNumberSeriesRecordSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  prefix: z.string(),
  separator: z.string(),
  padLength: z.number().int(),
  currentSequence: z.number().int(),
  resetStrategy: invoiceNumberResetStrategySchema,
  resetAt: z.string().nullable(),
  scope: invoiceNumberSeriesScopeSchema,
  isDefault: z.boolean(),
  externalProvider: z.string().nullable(),
  externalConfigKey: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type InvoiceNumberSeriesRecord = z.infer<typeof invoiceNumberSeriesRecordSchema>

export const invoiceRecordSchema = z
  .object({
    id: z.string(),
    invoiceNumber: z.string(),
    bookingId: z.string(),
    personId: z.string().nullable(),
    organizationId: z.string().nullable(),
    /**
     * `invoice` (final), `proforma` (placeholder pending bank transfer),
     * or `credit_note` (refund / cancellation). Drives the type badge
     * + filename on the booking detail page.
     */
    invoiceType: invoiceTypeSchema.optional(),
    status: invoiceStatusSchema,
    currency: z.string(),
    subtotalCents: z.number().int(),
    taxCents: z.number().int(),
    totalCents: z.number().int(),
    paidCents: z.number().int(),
    balanceDueCents: z.number().int(),
    issueDate: z.string(),
    dueDate: z.string(),
    notes: z.string().nullable(),
    voidedAt: z.string().nullable().optional(),
    voidReason: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    /**
     * Distinct payment-schedule ids referenced by this invoice's line
     * items. Populated by the list endpoint so the booking-detail
     * payment-schedule table can hide "Generate invoice/proforma" when
     * a document already covers a row.
     */
    bookingPaymentScheduleIds: z.array(z.string()).optional(),
    /**
     * For proforma rows, points at the final invoice that replaced
     * this proforma (and is the inverse of `convertedFromInvoiceId`).
     * Populated by `getInvoiceById` — letting the booking detail page
     * surface "Invoiced" status + a deep link on a void proforma.
     */
    convertedToInvoiceId: z.string().nullable().optional(),
    convertedToInvoiceNumber: z.string().nullable().optional(),
  })
  // Permissive on extra columns the server may return (e.g.
  // `convertedFromInvoiceId`, `baseCurrency`). Adding them all to the
  // schema invites churn; passthrough lets the UI use what it needs.
  .passthrough()

export type InvoiceRecord = z.infer<typeof invoiceRecordSchema>

export const lineItemRecordSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  description: z.string(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  totalCents: z.number().int(),
  taxRate: z.number().int().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
})

export type LineItemRecord = z.infer<typeof lineItemRecordSchema>

export const paymentRecordSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  amountCents: z.number().int(),
  currency: z.string(),
  baseCurrency: z.string().nullable(),
  baseAmountCents: z.number().int().nullable(),
  fxRateSetId: z.string().nullable().optional(),
  paymentMethod: z.string(),
  status: paymentStatusSchema,
  referenceNumber: z.string().nullable(),
  paymentDate: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

export type PaymentRecord = z.infer<typeof paymentRecordSchema>

export const creditNoteRecordSchema = z.object({
  id: z.string(),
  creditNoteNumber: z.string(),
  invoiceId: z.string(),
  status: creditNoteStatusSchema,
  amountCents: z.number().int(),
  currency: z.string(),
  reason: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

export type CreditNoteRecord = z.infer<typeof creditNoteRecordSchema>

export const financeNoteRecordSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  authorId: z.string(),
  content: z.string(),
  createdAt: z.string(),
})

export type FinanceNoteRecord = z.infer<typeof financeNoteRecordSchema>

export const supplierPaymentRecordSchema = z.object({
  id: z.string(),
  // AP payments may settle a whole invoice with no booking (§5.4).
  bookingId: z.string().nullable(),
  supplierInvoiceId: z.string().nullable().optional(),
  supplierId: z.string().nullable(),
  amountCents: z.number().int(),
  currency: z.string(),
  baseCurrency: z.string().nullable().optional(),
  baseAmountCents: z.number().int().nullable().optional(),
  fxRateSetId: z.string().nullable().optional(),
  paymentMethod: z.string(),
  status: paymentStatusSchema,
  referenceNumber: z.string().nullable(),
  paymentDate: z.string(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
})

export type SupplierPaymentRecord = z.infer<typeof supplierPaymentRecordSchema>

export const paymentKindSchema = z.enum(["customer", "supplier"])

export const unifiedPaymentRecordSchema = z.object({
  kind: paymentKindSchema,
  id: z.string(),
  invoiceId: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  bookingId: z.string().nullable(),
  bookingNumber: z.string().nullable(),
  supplierId: z.string().nullable(),
  supplierName: z.string().nullable(),
  personId: z.string().nullable(),
  personName: z.string().nullable(),
  organizationId: z.string().nullable(),
  organizationName: z.string().nullable(),
  amountCents: z.number().int(),
  currency: z.string(),
  baseCurrency: z.string().nullable(),
  baseAmountCents: z.number().int().nullable(),
  paymentMethod: z.string(),
  status: paymentStatusSchema,
  referenceNumber: z.string().nullable(),
  paymentDate: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type UnifiedPaymentRecord = z.infer<typeof unifiedPaymentRecordSchema>

export const paymentScheduleTypeSchema = z.enum([
  "deposit",
  "installment",
  "balance",
  "hold",
  "other",
])

export const paymentScheduleStatusSchema = z.enum([
  "pending",
  "due",
  "paid",
  "waived",
  "cancelled",
  "expired",
])

export const bookingPaymentScheduleRecordSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  bookingItemId: z.string().nullable(),
  scheduleType: paymentScheduleTypeSchema,
  status: paymentScheduleStatusSchema,
  dueDate: z.string(),
  currency: z.string(),
  amountCents: z.number().int(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type BookingPaymentScheduleRecord = z.infer<typeof bookingPaymentScheduleRecordSchema>

export const bookingPaymentSchedulesResponse = arrayEnvelope(bookingPaymentScheduleRecordSchema)

export const invoiceFxRateRecordSchema = z.object({
  baseCurrency: z.string(),
  quoteCurrency: z.string(),
  date: z.string().optional(),
  rate: z.number(),
  source: z.string().optional(),
  quotedAt: z.string().optional(),
  validUntil: z.string().optional(),
  fxCommissionBps: z.number().int().nonnegative().default(0),
  effectiveRate: z.number(),
  fxCommissionInvoiceMention: z.string().optional(),
})

export type InvoiceFxRateRecord = z.infer<typeof invoiceFxRateRecordSchema>

export const invoiceFxRateResponse = singleEnvelope(invoiceFxRateRecordSchema)

export const guaranteeTypeSchema = z.enum([
  "deposit",
  "credit_card",
  "preauth",
  "card_on_file",
  "bank_transfer",
  "voucher",
  "agency_letter",
  "other",
])

export const guaranteeStatusSchema = z.enum([
  "pending",
  "active",
  "released",
  "failed",
  "cancelled",
  "expired",
])

export const bookingGuaranteeRecordSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  bookingPaymentScheduleId: z.string().nullable(),
  bookingItemId: z.string().nullable(),
  guaranteeType: guaranteeTypeSchema,
  status: guaranteeStatusSchema,
  currency: z.string().nullable(),
  amountCents: z.number().int().nullable(),
  provider: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  guaranteedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  releasedAt: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type BookingGuaranteeRecord = z.infer<typeof bookingGuaranteeRecordSchema>

export const bookingGuaranteesResponse = arrayEnvelope(bookingGuaranteeRecordSchema)

export const invoiceAttachmentRecordSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  kind: z.string(),
  name: z.string(),
  mimeType: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  storageKey: z.string().nullable(),
  checksum: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
})

export type InvoiceAttachmentRecord = z.infer<typeof invoiceAttachmentRecordSchema>

// ---------- supplier invoices (accounts payable) ----------

export const supplierInvoiceStatusSchema = z.enum([
  "draft",
  "received",
  "approved",
  "partially_paid",
  "paid",
  "disputed",
  "void",
])
export type SupplierInvoiceStatus = z.infer<typeof supplierInvoiceStatusSchema>

export const apServiceTypeSchema = z.enum([
  "transport",
  "flight",
  "accommodation",
  "guide",
  "meal",
  "experience",
  "insurance",
  "other",
])
export type ApServiceType = z.infer<typeof apServiceTypeSchema>

export const costAllocationTargetTypeSchema = z.enum([
  "departure",
  "product",
  "booking",
  "traveler",
  "unattributed",
])
export const costAllocationSplitMethodSchema = z.enum(["manual", "per_pax", "equal", "weighted"])

export const supplierInvoiceLineRecordSchema = z.object({
  id: z.string(),
  supplierInvoiceId: z.string(),
  description: z.string(),
  serviceType: apServiceTypeSchema,
  costCategoryId: z.string().nullable().optional(),
  supplierServiceId: z.string().nullable(),
  quantity: z.number().int(),
  unitAmountCents: z.number().int(),
  taxRateBps: z.number().int().nullable(),
  taxAmountCents: z.number().int(),
  totalAmountCents: z.number().int(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type SupplierInvoiceLineRecord = z.infer<typeof supplierInvoiceLineRecordSchema>

export const supplierCostAllocationRecordSchema = z.object({
  id: z.string(),
  supplierInvoiceId: z.string(),
  supplierInvoiceLineId: z.string().nullable(),
  targetType: costAllocationTargetTypeSchema,
  departureId: z.string().nullable(),
  productId: z.string().nullable(),
  bookingId: z.string().nullable(),
  bookingItemId: z.string().nullable(),
  travelerId: z.string().nullable(),
  amountCents: z.number().int(),
  baseAmountCents: z.number().int().nullable(),
  splitMethod: costAllocationSplitMethodSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type SupplierCostAllocationRecord = z.infer<typeof supplierCostAllocationRecordSchema>

export const supplierInvoiceRecordSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  supplierInvoiceNo: z.string(),
  internalRef: z.string().nullable(),
  status: supplierInvoiceStatusSchema,
  currency: z.string(),
  baseCurrency: z.string().nullable(),
  fxRateSetId: z.string().nullable(),
  subtotalCents: z.number().int(),
  taxCents: z.number().int(),
  totalCents: z.number().int(),
  paidCents: z.number().int(),
  balanceDueCents: z.number().int(),
  taxRegimeId: z.string().nullable(),
  issueDate: z.string(),
  dueDate: z.string().nullable(),
  receivedAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  approvedBy: z.string().nullable(),
  storageKey: z.string().nullable(),
  extractionId: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type SupplierInvoiceRecord = z.infer<typeof supplierInvoiceRecordSchema>

export const supplierInvoiceDetailRecordSchema = supplierInvoiceRecordSchema.extend({
  lines: z.array(supplierInvoiceLineRecordSchema),
  allocations: z.array(supplierCostAllocationRecordSchema),
})
export type SupplierInvoiceDetailRecord = z.infer<typeof supplierInvoiceDetailRecordSchema>

export const supplierInvoiceAttachmentRecordSchema = z.object({
  id: z.string(),
  supplierInvoiceId: z.string(),
  kind: z.string(),
  name: z.string(),
  mimeType: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  storageKey: z.string().nullable(),
  checksum: z.string().nullable(),
  createdAt: z.string(),
})
export type SupplierInvoiceAttachmentRecord = z.infer<typeof supplierInvoiceAttachmentRecordSchema>

// ---------- profitability read model (RFC §8) ----------

export const profitabilityCostByServiceTypeSchema = z.object({
  serviceType: z.string(),
  currency: z.string(),
  amountCents: z.number().int(),
})
export type ProfitabilityCostByServiceType = z.infer<typeof profitabilityCostByServiceTypeSchema>

export const profitabilityUnattributedSchema = z.object({
  currency: z.string(),
  amountCents: z.number().int(),
})
export type ProfitabilityUnattributed = z.infer<typeof profitabilityUnattributedSchema>

export const departureProfitabilityRowSchema = z.object({
  departureId: z.string(),
  departureLabel: z.string().nullable(),
  productId: z.string().nullable(),
  productName: z.string().nullable(),
  departureDate: z.string().nullable(),
  currency: z.string(),
  revenueCents: z.number().int(),
  actualCostCents: z.number().int(),
  plannedCostCents: z.number().int(),
  profitCents: z.number().int(),
  marginPercent: z.number().nullable(),
  varianceCents: z.number().int(),
})
export type DepartureProfitabilityRow = z.infer<typeof departureProfitabilityRowSchema>

export const departureProfitabilityBaseRollupSchema = z.object({
  currency: z.string(),
  rows: z.array(departureProfitabilityRowSchema),
  costByServiceType: z.array(profitabilityCostByServiceTypeSchema),
  unattributedCents: z.number().int(),
  unconvertibleCurrencies: z.array(z.string()),
})
export type DepartureProfitabilityBaseRollup = z.infer<
  typeof departureProfitabilityBaseRollupSchema
>

export const departureProfitabilityReportSchema = z.object({
  rows: z.array(departureProfitabilityRowSchema),
  costByServiceType: z.array(profitabilityCostByServiceTypeSchema),
  unattributed: z.array(profitabilityUnattributedSchema),
  base: departureProfitabilityBaseRollupSchema.optional(),
})
export type DepartureProfitabilityReport = z.infer<typeof departureProfitabilityReportSchema>

export const productProfitabilityRowSchema = z.object({
  productId: z.string(),
  productName: z.string().nullable(),
  currency: z.string(),
  departureCount: z.number().int(),
  revenueCents: z.number().int(),
  actualCostCents: z.number().int(),
  plannedCostCents: z.number().int(),
  profitCents: z.number().int(),
  marginPercent: z.number().nullable(),
  varianceCents: z.number().int(),
})
export type ProductProfitabilityRow = z.infer<typeof productProfitabilityRowSchema>

export const productProfitabilityBaseRollupSchema = z.object({
  currency: z.string(),
  rows: z.array(productProfitabilityRowSchema),
  costByServiceType: z.array(profitabilityCostByServiceTypeSchema),
  unattributedCents: z.number().int(),
  unconvertibleCurrencies: z.array(z.string()),
})
export type ProductProfitabilityBaseRollup = z.infer<typeof productProfitabilityBaseRollupSchema>

export const productProfitabilityReportSchema = z.object({
  rows: z.array(productProfitabilityRowSchema),
  costByServiceType: z.array(profitabilityCostByServiceTypeSchema),
  unattributed: z.array(profitabilityUnattributedSchema),
  base: productProfitabilityBaseRollupSchema.optional(),
})
export type ProductProfitabilityReport = z.infer<typeof productProfitabilityReportSchema>

export const travelerProfitabilityRowSchema = z.object({
  travelerId: z.string(),
  travelerName: z.string(),
  bookingId: z.string(),
  currency: z.string(),
  revenueCents: z.number().int(),
  actualCostCents: z.number().int(),
  plannedCostCents: z.number().int(),
  profitCents: z.number().int(),
  marginPercent: z.number().nullable(),
  varianceCents: z.number().int(),
})
export type TravelerProfitabilityRow = z.infer<typeof travelerProfitabilityRowSchema>

export const travelerProfitabilityReportSchema = z.object({
  departureId: z.string(),
  currency: z.string(),
  travelerCount: z.number().int(),
  rows: z.array(travelerProfitabilityRowSchema),
})
export type TravelerProfitabilityReport = z.infer<typeof travelerProfitabilityReportSchema>

export const departureProfitabilityResponse = singleEnvelope(departureProfitabilityReportSchema)
export const productProfitabilityResponse = singleEnvelope(productProfitabilityReportSchema)
export const travelerProfitabilityResponse = singleEnvelope(travelerProfitabilityReportSchema)

// ---------- accountant shares + portal (RFC §13.2) ----------

export const accountantShareScopeSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
  baseCurrency: z.string().nullable(),
})

export const accountantShareRecordSchema = accountantShareScopeSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  lastAccessedAt: z.string().nullable(),
  accessCount: z.number().int(),
})
export type AccountantShareRecord = z.infer<typeof accountantShareRecordSchema>

export const accountantShareCreatedSchema = accountantShareScopeSchema.extend({
  id: z.string(),
  url: z.string(),
  expiresAt: z.string(),
})
export type AccountantShareCreated = z.infer<typeof accountantShareCreatedSchema>

export const accountantInvoiceAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  hasFile: z.boolean(),
})

export const accountantInvoiceRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(["client", "supplier"]),
  invoiceNumber: z.string(),
  status: z.string(),
  currency: z.string(),
  totalCents: z.number().int(),
  paidCents: z.number().int(),
  balanceDueCents: z.number().int(),
  issueDate: z.string(),
  dueDate: z.string().nullable(),
  attachments: z.array(accountantInvoiceAttachmentSchema),
})
export type AccountantInvoiceRecord = z.infer<typeof accountantInvoiceRecordSchema>

export const accountantSummarySchema = z.object({
  scope: accountantShareScopeSchema,
  departures: departureProfitabilityReportSchema,
  products: productProfitabilityReportSchema,
})
export type AccountantSummary = z.infer<typeof accountantSummarySchema>

// ---------- cost categories ----------

export const costCategoryRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type CostCategoryRecord = z.infer<typeof costCategoryRecordSchema>

export const costCategoriesResponse = arrayEnvelope(costCategoryRecordSchema)
export const costCategorySingleResponse = singleEnvelope(costCategoryRecordSchema)

export const accountantSharesResponse = arrayEnvelope(accountantShareRecordSchema)
export const accountantShareCreatedResponse = singleEnvelope(accountantShareCreatedSchema)
export const accountantShareRevokedResponse = singleEnvelope(z.object({ id: z.string() }))
export const accountantSummaryResponse = singleEnvelope(accountantSummarySchema)
export const accountantInvoicesResponse = arrayEnvelope(accountantInvoiceRecordSchema)

export const supplierInvoiceListResponse = paginatedEnvelope(supplierInvoiceRecordSchema)
export const supplierInvoiceSingleResponse = singleEnvelope(supplierInvoiceDetailRecordSchema)
export const supplierInvoiceAttachmentsResponse = arrayEnvelope(
  supplierInvoiceAttachmentRecordSchema,
)

export const invoiceListResponse = paginatedEnvelope(invoiceRecordSchema)
export const invoiceNumberSeriesListResponse = paginatedEnvelope(invoiceNumberSeriesRecordSchema)
export const invoiceNumberSeriesSingleResponse = singleEnvelope(invoiceNumberSeriesRecordSchema)
export const supplierPaymentListResponse = paginatedEnvelope(supplierPaymentRecordSchema)
export const allPaymentsListResponse = paginatedEnvelope(unifiedPaymentRecordSchema)
export const paymentSingleResponse = singleEnvelope(unifiedPaymentRecordSchema)
export const invoiceSingleResponse = singleEnvelope(invoiceRecordSchema)
export const invoiceLineItemsResponse = arrayEnvelope(lineItemRecordSchema)
export const invoicePaymentsResponse = arrayEnvelope(paymentRecordSchema)
export const invoiceCreditNotesResponse = arrayEnvelope(creditNoteRecordSchema)
export const invoiceNotesResponse = arrayEnvelope(financeNoteRecordSchema)
export const invoiceAttachmentsResponse = arrayEnvelope(invoiceAttachmentRecordSchema)

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

export {
  publicBookingFinanceDocumentsSchema,
  publicBookingFinancePaymentsSchema,
  publicBookingPaymentOptionsSchema,
  publicFinanceBookingDocumentSchema,
  publicFinanceBookingPaymentSchema,
  publicFinanceDocumentLookupQuerySchema,
  publicFinanceDocumentLookupSchema,
  publicPaymentOptionsQuerySchema,
  publicPaymentSessionSchema,
  publicStartPaymentSessionSchema,
  publicValidateVoucherSchema,
  publicVoucherValidationSchema,
}

export const publicBookingPaymentOptionsResponse = singleEnvelope(publicBookingPaymentOptionsSchema)
export const publicBookingFinanceDocumentsResponse = singleEnvelope(
  publicBookingFinanceDocumentsSchema,
)
export const publicFinanceDocumentLookupResponse = singleEnvelope(publicFinanceDocumentLookupSchema)
export const publicBookingFinancePaymentsResponse = singleEnvelope(
  publicBookingFinancePaymentsSchema,
)
export const publicPaymentSessionResponse = singleEnvelope(publicPaymentSessionSchema)
export const publicVoucherValidationResponse = singleEnvelope(publicVoucherValidationSchema)

export type PublicBookingPaymentOptionsRecord = z.infer<typeof publicBookingPaymentOptionsSchema>
export type PublicBookingFinanceDocumentsRecord = z.infer<
  typeof publicBookingFinanceDocumentsSchema
>
export type PublicFinanceDocumentLookupQuery = z.input<
  typeof publicFinanceDocumentLookupQuerySchema
>
export type PublicFinanceDocumentLookupRecord = z.infer<typeof publicFinanceDocumentLookupSchema>
export type PublicBookingFinancePaymentsRecord = z.infer<typeof publicBookingFinancePaymentsSchema>
export type PublicFinanceBookingDocumentRecord = z.infer<typeof publicFinanceBookingDocumentSchema>
export type PublicFinanceBookingPaymentRecord = z.infer<typeof publicFinanceBookingPaymentSchema>
export type PublicPaymentSessionRecord = z.infer<typeof publicPaymentSessionSchema>
export type PublicStartPaymentSessionInput = z.input<typeof publicStartPaymentSessionSchema>
export type PublicValidateVoucherInput = z.input<typeof publicValidateVoucherSchema>
export type PublicVoucherValidationRecord = z.infer<typeof publicVoucherValidationSchema>

// ---------- admin vouchers ----------

export const voucherStatusSchema = z.enum(["active", "redeemed", "expired", "void"])
export const voucherSourceTypeSchema = z.enum([
  "refund",
  "cancellation_credit",
  "gift",
  "manual",
  "promo",
])

export const voucherRecordSchema = z.object({
  id: z.string(),
  code: z.string(),
  status: voucherStatusSchema,
  currency: z.string(),
  initialAmountCents: z.number().int(),
  remainingAmountCents: z.number().int(),
  issuedToPersonId: z.string().nullable(),
  issuedToOrganizationId: z.string().nullable(),
  sourceType: voucherSourceTypeSchema,
  sourceBookingId: z.string().nullable(),
  sourcePaymentId: z.string().nullable(),
  expiresAt: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  issuedByUserId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type VoucherRecord = z.infer<typeof voucherRecordSchema>

export const voucherRedemptionRecordSchema = z.object({
  id: z.string(),
  voucherId: z.string(),
  bookingId: z.string(),
  paymentId: z.string().nullable(),
  amountCents: z.number().int(),
  createdByUserId: z.string().nullable(),
  createdAt: z.coerce.date(),
})
export type VoucherRedemptionRecord = z.infer<typeof voucherRedemptionRecordSchema>

export const voucherDetailSchema = voucherRecordSchema.extend({
  redemptions: z.array(voucherRedemptionRecordSchema),
})
export type VoucherDetailRecord = z.infer<typeof voucherDetailSchema>

/** Result envelope for `POST /v1/admin/finance/vouchers/:id/redeem`. */
export const voucherRedemptionResultSchema = z.object({
  voucher: voucherRecordSchema,
  redemption: voucherRedemptionRecordSchema.nullable(),
})
export type VoucherRedemptionResult = z.infer<typeof voucherRedemptionResultSchema>

export const voucherListResponse = paginatedEnvelope(voucherRecordSchema)
export const voucherDetailResponse = singleEnvelope(voucherDetailSchema)
export const voucherSingleResponse = singleEnvelope(voucherRecordSchema)
export const voucherRedemptionResponse = singleEnvelope(voucherRedemptionResultSchema)
