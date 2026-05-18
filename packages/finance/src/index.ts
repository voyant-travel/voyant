import type { LinkableDefinition, Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"
import { Hono } from "hono"

import {
  buildFinanceRouteRuntime,
  FINANCE_ROUTE_RUNTIME_CONTAINER_KEY,
  type FinanceRuntimeOptions,
} from "./route-runtime.js"
import { financeRoutes } from "./routes.js"
import { financeActionLedgerRoutes } from "./routes-action-ledger.js"
import { createFinanceAdminDocumentRoutes } from "./routes-documents.js"
import { createPublicFinanceRoutes, type PublicFinanceRouteOptions } from "./routes-public.js"
import { createFinanceAdminSettlementRoutes } from "./routes-settlement.js"

export type { FinanceRoutes } from "./routes.js"
export type { PublicFinanceRoutes } from "./routes-public.js"
export {
  createPublicFinanceRoutes,
  type PublicFinanceRouteOptions,
  publicFinanceRoutes,
} from "./routes-public.js"
export { type PublicFinanceRuntimeOptions, publicFinanceService } from "./service-public.js"

export const invoiceLinkable: LinkableDefinition = {
  module: "finance",
  entity: "invoice",
  table: "invoices",
  idPrefix: "inv",
}

export const invoiceTemplateLinkable: LinkableDefinition = {
  module: "finance",
  entity: "invoiceTemplate",
  table: "invoice_templates",
  idPrefix: "invt",
}

export const creditNoteLinkable: LinkableDefinition = {
  module: "finance",
  entity: "creditNote",
  table: "credit_notes",
  idPrefix: "crn",
}

export const financeLinkable = {
  invoice: invoiceLinkable,
  invoiceTemplate: invoiceTemplateLinkable,
  creditNote: creditNoteLinkable,
}

export const financeModule: Module = {
  name: "finance",
  linkable: financeLinkable,
}

export interface FinanceHonoModuleOptions
  extends FinanceRuntimeOptions,
    PublicFinanceRouteOptions {}

export function createFinanceHonoModule(options: FinanceHonoModuleOptions = {}): HonoModule {
  const adminRoutes = new Hono()
    .route("/", financeRoutes)
    .route("/", financeActionLedgerRoutes)
    .route("/", createFinanceAdminDocumentRoutes(options))
    .route("/", createFinanceAdminSettlementRoutes(options))

  const module: Module = {
    ...financeModule,
    bootstrap: ({ bindings, container, eventBus }) => {
      const runtime = buildFinanceRouteRuntime(bindings as Record<string, unknown>, options)
      // Wire the framework's eventBus into the route runtime so subscribers
      // (notably the storefront's checkout-finalize workflow on
      // `payment.completed`) actually receive emissions from
      // `financeService.completePaymentSession`. Without this, the Netopia
      // webhook silently no-ops because the runtime has no bus attached.
      if (!runtime.eventBus && eventBus) runtime.eventBus = eventBus
      container.register(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY, runtime)
    },
  }

  return {
    module,
    adminRoutes,
    publicRoutes: createPublicFinanceRoutes(options),
    routes: adminRoutes,
  }
}

export const financeHonoModule: HonoModule = createFinanceHonoModule()

export {
  type BookingTaxRouteOptions,
  type BookingTaxSettings,
  computeBookingItemTaxLine,
  createBookingTaxHonoExtension,
  createBookingTaxRoutes,
  loadProductTaxFacts,
  matchesTaxPolicyCondition,
  mountBookingTaxRoutes,
  type ProductTaxFacts,
  type ResolveBookingSellTaxRateOptions,
  type ResolveBookingTaxSettings,
  type ResolvedBookingSellTaxRate,
  resolveBookingSellTaxRate,
  type TaxPolicyCondition,
  type UpdateBookingTaxSettings,
} from "./booking-tax.js"
export type {
  ComputedScheduleEntry,
  ComputeScheduleInput,
  DepositKind,
  DepositRule,
  PaymentPolicy,
  PaymentPolicyCascadeLayers,
  PaymentPolicySource,
  PaymentScheduleEntryType,
  ResolvedPaymentPolicy,
} from "./payment-policy.js"
export {
  computePaymentSchedule,
  isPaymentPolicyEmpty,
  noDepositPolicy,
  policyShouldRequireFullPayment,
  resolveEffectivePaymentPolicy,
} from "./payment-policy.js"
export {
  buildFinanceRouteRuntime,
  FINANCE_ROUTE_RUNTIME_CONTAINER_KEY,
  type FinanceRouteRuntime,
  type FinanceRuntimeOptions,
} from "./route-runtime.js"
export { bookingsCreateExtension } from "./routes-booking-create.js"
export {
  createFinanceAdminDocumentRoutes,
  type FinanceDocumentRouteOptions,
  type InvoiceDocumentGenerator,
} from "./routes-documents.js"
export {
  createFinanceAdminSettlementRoutes,
  type FinanceSettlementRouteOptions,
  type InvoiceSettlementPoller,
} from "./routes-settlement.js"
export type {
  BookingGuarantee,
  BookingItemCommission,
  BookingItemTaxLine,
  BookingPaymentSchedule,
  CreditNote,
  CreditNoteLineItem,
  FinanceNote,
  Invoice,
  InvoiceAttachment,
  InvoiceExternalRef,
  InvoiceLineItem,
  InvoiceNumberSeries,
  InvoiceRendition,
  InvoiceTemplate,
  NewBookingGuarantee,
  NewBookingItemCommission,
  NewBookingItemTaxLine,
  NewBookingPaymentSchedule,
  NewCreditNote,
  NewCreditNoteLineItem,
  NewFinanceNote,
  NewInvoice,
  NewInvoiceAttachment,
  NewInvoiceExternalRef,
  NewInvoiceLineItem,
  NewInvoiceNumberSeries,
  NewInvoiceRendition,
  NewInvoiceTemplate,
  NewPayment,
  NewPaymentAuthorization,
  NewPaymentCapture,
  NewPaymentInstrument,
  NewPaymentSession,
  NewSupplierPayment,
  NewTaxClass,
  NewTaxRegime,
  NewVoucher,
  NewVoucherRedemption,
  Payment,
  PaymentAuthorization,
  PaymentCapture,
  PaymentInstrument,
  PaymentSession,
  SupplierPayment,
  TaxClass,
  TaxRegime,
  Voucher,
  VoucherRedemption,
} from "./schema.js"
export {
  bookingGuarantees,
  bookingItemCommissions,
  bookingItemTaxLines,
  bookingPaymentSchedules,
  creditNoteLineItems,
  creditNotes,
  financeNotes,
  invoiceAttachments,
  invoiceExternalRefs,
  invoiceLineItems,
  invoiceNumberSeries,
  invoiceRenditions,
  invoices,
  invoiceTemplates,
  paymentAuthorizations,
  paymentCaptures,
  paymentInstruments,
  paymentSessions,
  payments,
  supplierPayments,
  taxClasses,
  taxPolicyProfiles,
  taxPolicyRules,
  taxRegimes,
  voucherRedemptions,
  voucherSourceTypeEnum,
  voucherStatusEnum,
  vouchers,
} from "./schema.js"
export type {
  BindInvoiceRenditionInput,
  BookingPaymentSchedulePaidEvent,
  CreateInvoiceFromBookingInput,
  InvoiceFromBookingData,
  InvoiceRenderedEvent,
  PaymentCompletedEvent,
  UnifiedPaymentRow,
} from "./service.js"
export { financeService, renderInvoiceBody } from "./service.js"
export type {
  FinanceAggregateOutstandingInvoice,
  FinanceAggregates,
} from "./service-aggregates.js"
export type {
  BookingCreatedEvent,
  BookingCreateInput,
  BookingCreateOutcome,
  BookingCreateResult,
  BookingCreateRuntime,
  BookingCreateTravelerInput,
} from "./service-booking-create.js"
export {
  bookingCreateSchema,
  createBooking,
} from "./service-booking-create.js"
export type {
  BookingDualCreatedEvent,
  DualCreateBookingInput,
  DualCreateBookingOutcome,
  DualCreateBookingResult,
  DualCreateBookingRuntime,
} from "./service-bookings-dual-create.js"
export {
  dualCreateBooking,
  dualCreateBookingSchema,
} from "./service-bookings-dual-create.js"
export type {
  GeneratedInvoiceDocumentRecord,
  GeneratedInvoiceRenditionArtifact,
  InvoiceDocumentGeneratedEvent,
  InvoiceDocumentGeneratorContext,
  InvoiceDocumentRuntimeOptions,
  StorageBackedInvoiceDocumentGeneratorOptions,
  StorageBackedInvoiceDocumentSerializer,
  StorageBackedInvoiceDocumentUpload,
} from "./service-documents.js"
export {
  createPdfInvoiceDocumentGenerator,
  createStorageBackedInvoiceDocumentGenerator,
  defaultPdfInvoiceDocumentSerializer,
  defaultStorageBackedInvoiceDocumentSerializer,
  financeDocumentsService,
} from "./service-documents.js"
export type { InvoiceIssuedEvent, InvoiceIssueRuntime } from "./service-issue.js"
export { issueInvoiceFromBooking, issueProformaFromBooking } from "./service-issue.js"
export type {
  FinanceSettlementRuntimeOptions,
  InvoiceSettledEvent,
  InvoiceSettlementPollerContext,
  InvoiceSettlementPollerResult,
} from "./service-settlement.js"
export { financeSettlementService } from "./service-settlement.js"
export { VoucherServiceError, vouchersService } from "./service-vouchers.js"
export {
  migrateVouchersFromPaymentInstruments,
  type VoucherMigrationOptions,
  type VoucherMigrationResult,
  type VoucherMigrationSkip,
} from "./service-vouchers-migration.js"
export type {
  GeneratedInvoiceDocumentResult,
  GenerateInvoiceDocumentInput,
  PolledInvoiceSettlementResult,
  PollInvoiceSettlementInput,
} from "./validation.js"
export {
  agingReportQuerySchema,
  allocateInvoiceNumberInputSchema,
  applyDefaultBookingPaymentPlanSchema,
  cancelPaymentSessionSchema,
  completePaymentSessionSchema,
  createPaymentSessionFromGuaranteeSchema,
  createPaymentSessionFromInvoiceSchema,
  createPaymentSessionFromScheduleSchema,
  expirePaymentSessionSchema,
  failPaymentSessionSchema,
  financeAggregatesQuerySchema,
  generatedInvoiceDocumentResultSchema,
  generateInvoiceDocumentInputSchema,
  insertBookingGuaranteeSchema,
  insertBookingItemCommissionSchema,
  insertBookingItemTaxLineSchema,
  insertBookingPaymentScheduleSchema,
  insertCreditNoteLineItemSchema,
  insertCreditNoteSchema,
  insertFinanceNoteSchema,
  insertInvoiceExternalRefSchema,
  insertInvoiceLineItemSchema,
  insertInvoiceNumberSeriesSchema,
  insertInvoiceRenditionSchema,
  insertInvoiceSchema,
  insertInvoiceTemplateSchema,
  insertPaymentAuthorizationSchema,
  insertPaymentCaptureSchema,
  insertPaymentInstrumentSchema,
  insertPaymentSchema,
  insertPaymentSessionSchema,
  insertSupplierPaymentSchema,
  insertTaxClassSchema,
  insertTaxPolicyProfileSchema,
  insertTaxPolicyRuleSchema,
  insertTaxRegimeSchema,
  invoiceFromBookingSchema,
  invoiceListQuerySchema,
  invoiceNumberSeriesListQuerySchema,
  invoiceTemplateListQuerySchema,
  markPaymentSessionRequiresRedirectSchema,
  paymentAuthorizationListQuerySchema,
  paymentCaptureListQuerySchema,
  paymentInstrumentListQuerySchema,
  paymentKindSchema,
  paymentListQuerySchema,
  paymentListSortDirSchema,
  paymentListSortFieldSchema,
  paymentSessionListQuerySchema,
  polledInvoiceSettlementProviderResultSchema,
  polledInvoiceSettlementResultSchema,
  pollInvoiceSettlementInputSchema,
  profitabilityQuerySchema,
  renderInvoiceInputSchema,
  revenueReportQuerySchema,
  supplierPaymentListQuerySchema,
  taxClassListQuerySchema,
  taxPolicyProfileListQuerySchema,
  taxPolicyRuleListQuerySchema,
  taxRegimeListQuerySchema,
  updateBookingGuaranteeSchema,
  updateBookingItemCommissionSchema,
  updateBookingItemTaxLineSchema,
  updateBookingPaymentScheduleSchema,
  updateCreditNoteLineItemSchema,
  updateCreditNoteSchema,
  updateInvoiceExternalRefSchema,
  updateInvoiceLineItemSchema,
  updateInvoiceNumberSeriesSchema,
  updateInvoiceRenditionSchema,
  updateInvoiceSchema,
  updateInvoiceTemplateSchema,
  updatePaymentAuthorizationSchema,
  updatePaymentCaptureSchema,
  updatePaymentInstrumentSchema,
  updatePaymentSchema,
  updatePaymentSessionSchema,
  updateSupplierPaymentSchema,
  updateTaxClassSchema,
  updateTaxPolicyProfileSchema,
  updateTaxPolicyRuleSchema,
  updateTaxRegimeSchema,
} from "./validation.js"
export type {
  PublicBookingFinanceDocuments,
  PublicBookingFinancePayments,
  PublicBookingPaymentOptions,
  PublicFinanceBookingDocument,
  PublicFinanceBookingPayment,
  PublicFinanceDocumentLookup,
  PublicFinanceDocumentLookupQuery,
  PublicPaymentOptionsQuery,
  PublicPaymentSession,
  PublicStartPaymentSessionInput,
  PublicValidateVoucherInput,
  PublicVoucherValidationResult,
} from "./validation-public.js"
export {
  publicBookingFinanceDocumentsSchema,
  publicBookingFinancePaymentsSchema,
  publicBookingPaymentOptionsSchema,
  publicFinanceBookingDocumentSchema,
  publicFinanceBookingPaymentSchema,
  publicFinanceDocumentAvailabilitySchema,
  publicFinanceDocumentFormatSchema,
  publicFinanceDocumentLookupQuerySchema,
  publicFinanceDocumentLookupSchema,
  publicFinanceInvoiceTypeSchema,
  publicPaymentOptionsQuerySchema,
  publicPaymentSessionSchema,
  publicStartPaymentSessionSchema,
  publicValidateVoucherSchema,
  publicVoucherValidationSchema,
} from "./validation-public.js"
