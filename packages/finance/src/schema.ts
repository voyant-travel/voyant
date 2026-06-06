import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { relations, sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

// ---------- enums ----------

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "pending_external_allocation",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "void",
])

export const paymentMethodEnum = pgEnum("payment_method", [
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

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "completed",
  "failed",
  "refunded",
])

export const paymentSessionStatusEnum = pgEnum("payment_session_status", [
  "pending",
  "requires_redirect",
  "processing",
  "authorized",
  "paid",
  "failed",
  "cancelled",
  "expired",
])

export const paymentSessionTargetTypeEnum = pgEnum("payment_session_target_type", [
  "booking",
  "order",
  "invoice",
  "booking_payment_schedule",
  "booking_guarantee",
  "flight_order",
  "other",
])

export const paymentInstrumentTypeEnum = pgEnum("payment_instrument_type", [
  "credit_card",
  "debit_card",
  "bank_account",
  "wallet",
  "voucher",
  "direct_bill",
  "cash",
  "other",
])

export const paymentInstrumentOwnerTypeEnum = pgEnum("payment_instrument_owner_type", [
  "client",
  "supplier",
  "channel",
  "agency",
  "internal",
  "other",
])

export const paymentInstrumentStatusEnum = pgEnum("payment_instrument_status", [
  "active",
  "inactive",
  "expired",
  "revoked",
  "failed_verification",
])

export const paymentAuthorizationStatusEnum = pgEnum("payment_authorization_status", [
  "pending",
  "authorized",
  "partially_captured",
  "captured",
  "voided",
  "failed",
  "expired",
])

export const paymentCaptureStatusEnum = pgEnum("payment_capture_status", [
  "pending",
  "completed",
  "failed",
  "refunded",
  "voided",
])

export const captureModeEnum = pgEnum("capture_mode", ["automatic", "manual"])

export const creditNoteStatusEnum = pgEnum("credit_note_status", ["draft", "issued", "applied"])

export const paymentScheduleTypeEnum = pgEnum("payment_schedule_type", [
  "deposit",
  "installment",
  "balance",
  "hold",
  "other",
])

export const paymentScheduleStatusEnum = pgEnum("payment_schedule_status", [
  "pending",
  "due",
  "paid",
  "waived",
  "cancelled",
  "expired",
])

export const guaranteeTypeEnum = pgEnum("guarantee_type", [
  "deposit",
  "credit_card",
  "preauth",
  "card_on_file",
  "bank_transfer",
  "voucher",
  "agency_letter",
  "other",
])

export const guaranteeStatusEnum = pgEnum("guarantee_status", [
  "pending",
  "active",
  "released",
  "failed",
  "cancelled",
  "expired",
])

export const taxScopeEnum = pgEnum("tax_scope", ["included", "excluded", "withheld"])

export const commissionRecipientTypeEnum = pgEnum("commission_recipient_type", [
  "channel",
  "affiliate",
  "agency",
  "agent",
  "internal",
  "supplier",
  "other",
])

export const commissionModelEnum = pgEnum("commission_model", [
  "percentage",
  "fixed",
  "markup",
  "net",
])

export const commissionStatusEnum = pgEnum("commission_status", [
  "pending",
  "accrued",
  "payable",
  "paid",
  "void",
])

export const invoiceTypeEnum = pgEnum("invoice_type", ["invoice", "proforma", "credit_note"])

export const invoiceNumberResetStrategyEnum = pgEnum("invoice_number_reset_strategy", [
  "never",
  "annual",
  "monthly",
])

export const invoiceNumberSeriesScopeEnum = pgEnum("invoice_number_series_scope", [
  "invoice",
  "proforma",
  "credit_note",
])

export const invoiceRenditionFormatEnum = pgEnum("invoice_rendition_format", [
  "html",
  "pdf",
  "xml",
  "json",
])

export const invoiceRenditionStatusEnum = pgEnum("invoice_rendition_status", [
  "pending",
  "ready",
  "failed",
  "stale",
])

export const invoiceTemplateBodyFormatEnum = pgEnum("invoice_template_body_format", [
  "html",
  "markdown",
  "lexical_json",
])

export const taxRegimeCodeEnum = pgEnum("tax_regime_code", [
  "standard",
  "reduced",
  "exempt",
  "reverse_charge",
  "margin_scheme_art311",
  "zero_rated",
  "out_of_scope",
  "other",
])

// ---------- vouchers ----------

export const voucherStatusEnum = pgEnum("voucher_status", ["active", "redeemed", "expired", "void"])

export const voucherSourceTypeEnum = pgEnum("voucher_source_type", [
  "refund",
  "cancellation_credit",
  "gift",
  "manual",
  "promo",
])

// ---------- accounts payable (supplier invoices) ----------
// See docs/architecture/supplier-invoices-profitability.md §5.

/**
 * Status flow for a received supplier invoice. Mirrors the AR invoice flow
 * where it can; `approved` and `disputed` are AP-specific (an operator
 * approves a payable before it can be paid; a contested bill is disputed).
 */
export const supplierInvoiceStatusEnum = pgEnum("supplier_invoice_status", [
  "draft",
  "received",
  "approved",
  "partially_paid",
  "paid",
  "disputed",
  "void",
])

/**
 * AP-local service taxonomy for supplier-invoice lines. Deliberately NOT the
 * shared `serviceTypeEnum` (suppliers/products) — extending that is a ~17-file
 * cross-package sweep (§5.6). This local enum carries the categories operators
 * think in for cost breakdown charts, including `flight` (named in the request
 * but absent from the shared enum) and `insurance`.
 */
export const apServiceTypeEnum = pgEnum("ap_service_type", [
  "transport",
  "flight",
  "accommodation",
  "guide",
  "meal",
  "experience",
  "insurance",
  "other",
])

/** What a supplier cost allocation attributes the cost to (§6). */
export const costAllocationTargetTypeEnum = pgEnum("cost_allocation_target_type", [
  "departure",
  "product",
  "booking",
  "traveler",
  "unattributed",
])

/** How a multi-target split was derived, for "derived vs explicit" display (§6). */
export const costAllocationSplitMethodEnum = pgEnum("cost_allocation_split_method", [
  "manual",
  "per_pax",
  "equal",
  "weighted",
])

export const vouchers = pgTable(
  "vouchers",
  {
    id: typeId("vouchers"),
    code: text("code").notNull(),
    /**
     * Batch / campaign identifier. Optional grouping used when a supplier or
     * promo issues many vouchers at once ("GIFT-2026-Q1") and wants to
     * aggregate/revoke them by series. Not indexed uniquely — multiple rows
     * can share the same seriesCode.
     *
     * Aligned with OpenTravel 2019A Finance.Voucher.seriesCode.
     */
    seriesCode: text("series_code"),
    status: voucherStatusEnum("status").notNull().default("active"),
    currency: text("currency").notNull(),
    initialAmountCents: integer("initial_amount_cents").notNull(),
    remainingAmountCents: integer("remaining_amount_cents").notNull(),
    issuedToPersonId: text("issued_to_person_id"),
    issuedToOrganizationId: text("issued_to_organization_id"),
    sourceType: voucherSourceTypeEnum("source_type").notNull(),
    sourceBookingId: text("source_booking_id"),
    sourcePaymentId: text("source_payment_id"),
    /**
     * Start-of-validity. Nullable — when set, a redemption attempt before
     * this timestamp returns `voucher_not_started`. Needed for gift
     * vouchers that are issued immediately but shouldn't be redeemable
     * until the recipient's birthday, new year, etc.
     *
     * Aligned with OpenTravel 2019A Finance.Voucher.effectiveDate.
     */
    validFrom: timestamp("valid_from", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    notes: text("notes"),
    issuedByUserId: text("issued_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_vouchers_code").on(table.code),
    index("idx_vouchers_series").on(table.seriesCode),
    index("idx_vouchers_status").on(table.status),
    index("idx_vouchers_person").on(table.issuedToPersonId),
    index("idx_vouchers_organization").on(table.issuedToOrganizationId),
    index("idx_vouchers_source_booking").on(table.sourceBookingId),
    index("idx_vouchers_valid_from").on(table.validFrom),
    index("idx_vouchers_expires_at").on(table.expiresAt),
    index("idx_vouchers_remaining").on(table.remainingAmountCents),
  ],
)

export type Voucher = typeof vouchers.$inferSelect
export type NewVoucher = typeof vouchers.$inferInsert

export const voucherRedemptions = pgTable(
  "voucher_redemptions",
  {
    id: typeId("voucher_redemptions"),
    voucherId: typeIdRef("voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "cascade" }),
    bookingId: text("booking_id").notNull(),
    paymentId: text("payment_id"),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id"),
  },
  (table) => [
    index("idx_voucher_redemptions_voucher").on(table.voucherId),
    index("idx_voucher_redemptions_booking").on(table.bookingId),
    index("idx_voucher_redemptions_voucher_created").on(table.voucherId, table.createdAt),
  ],
)

export type VoucherRedemption = typeof voucherRedemptions.$inferSelect
export type NewVoucherRedemption = typeof voucherRedemptions.$inferInsert

// ---------- payment_instruments ----------

export const paymentInstruments = pgTable(
  "payment_instruments",
  {
    id: typeId("payment_instruments"),
    ownerType: paymentInstrumentOwnerTypeEnum("owner_type").notNull().default("client"),
    personId: text("person_id"),
    organizationId: text("organization_id"),
    supplierId: text("supplier_id"),
    channelId: text("channel_id"),
    instrumentType: paymentInstrumentTypeEnum("instrument_type").notNull(),
    status: paymentInstrumentStatusEnum("status").notNull().default("active"),
    label: text("label").notNull(),
    provider: text("provider"),
    brand: text("brand"),
    last4: text("last4"),
    holderName: text("holder_name"),
    expiryMonth: integer("expiry_month"),
    expiryYear: integer("expiry_year"),
    externalToken: text("external_token"),
    externalCustomerId: text("external_customer_id"),
    billingEmail: text("billing_email"),
    billingAddress: text("billing_address"),
    directBillReference: text("direct_bill_reference"),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_payment_instruments_owner_type").on(table.ownerType),
    index("idx_payment_instruments_owner_type_updated").on(table.ownerType, table.updatedAt),
    index("idx_payment_instruments_person").on(table.personId),
    index("idx_payment_instruments_person_updated").on(table.personId, table.updatedAt),
    index("idx_payment_instruments_organization").on(table.organizationId),
    index("idx_payment_instruments_organization_updated").on(table.organizationId, table.updatedAt),
    index("idx_payment_instruments_supplier").on(table.supplierId),
    index("idx_payment_instruments_supplier_updated").on(table.supplierId, table.updatedAt),
    index("idx_payment_instruments_channel").on(table.channelId),
    index("idx_payment_instruments_channel_updated").on(table.channelId, table.updatedAt),
    index("idx_payment_instruments_status").on(table.status),
    index("idx_payment_instruments_status_updated").on(table.status, table.updatedAt),
    index("idx_payment_instruments_type").on(table.instrumentType),
    index("idx_payment_instruments_type_updated").on(table.instrumentType, table.updatedAt),
  ],
)

export type PaymentInstrument = typeof paymentInstruments.$inferSelect
export type NewPaymentInstrument = typeof paymentInstruments.$inferInsert

// ---------- payment_sessions ----------

export const paymentSessions = pgTable(
  "payment_sessions",
  {
    id: typeId("payment_sessions"),
    targetType: paymentSessionTargetTypeEnum("target_type").notNull().default("other"),
    targetId: text("target_id"),
    bookingId: text("booking_id"),
    orderId: text("order_id"),
    invoiceId: typeIdRef("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    bookingPaymentScheduleId: typeIdRef("booking_payment_schedule_id").references(
      () => bookingPaymentSchedules.id,
      { onDelete: "set null" },
    ),
    bookingGuaranteeId: typeIdRef("booking_guarantee_id").references(() => bookingGuarantees.id, {
      onDelete: "set null",
    }),
    paymentInstrumentId: typeIdRef("payment_instrument_id").references(
      () => paymentInstruments.id,
      { onDelete: "set null" },
    ),
    paymentAuthorizationId: typeIdRef("payment_authorization_id").references(
      () => paymentAuthorizations.id,
      { onDelete: "set null" },
    ),
    paymentCaptureId: typeIdRef("payment_capture_id").references(() => paymentCaptures.id, {
      onDelete: "set null",
    }),
    paymentId: typeIdRef("payment_id").references(() => payments.id, {
      onDelete: "set null",
    }),
    status: paymentSessionStatusEnum("status").notNull().default("pending"),
    provider: text("provider"),
    providerSessionId: text("provider_session_id"),
    providerPaymentId: text("provider_payment_id"),
    externalReference: text("external_reference"),
    idempotencyKey: text("idempotency_key"),
    clientReference: text("client_reference"),
    currency: text("currency").notNull(),
    amountCents: integer("amount_cents").notNull(),
    paymentMethod: paymentMethodEnum("payment_method"),
    payerPersonId: text("payer_person_id"),
    payerOrganizationId: text("payer_organization_id"),
    payerEmail: text("payer_email"),
    payerName: text("payer_name"),
    redirectUrl: text("redirect_url"),
    returnUrl: text("return_url"),
    cancelUrl: text("cancel_url"),
    callbackUrl: text("callback_url"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    notes: text("notes"),
    providerPayload: jsonb("provider_payload").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_payment_sessions_target").on(table.targetType, table.targetId),
    index("idx_payment_sessions_target_created").on(table.targetType, table.createdAt),
    index("idx_payment_sessions_booking").on(table.bookingId),
    index("idx_payment_sessions_booking_created").on(table.bookingId, table.createdAt),
    index("idx_payment_sessions_order").on(table.orderId),
    index("idx_payment_sessions_order_created").on(table.orderId, table.createdAt),
    index("idx_payment_sessions_invoice").on(table.invoiceId),
    index("idx_payment_sessions_invoice_created").on(table.invoiceId, table.createdAt),
    index("idx_payment_sessions_schedule").on(table.bookingPaymentScheduleId),
    index("idx_payment_sessions_schedule_created").on(
      table.bookingPaymentScheduleId,
      table.createdAt,
    ),
    index("idx_payment_sessions_guarantee").on(table.bookingGuaranteeId),
    index("idx_payment_sessions_guarantee_created").on(table.bookingGuaranteeId, table.createdAt),
    index("idx_payment_sessions_status").on(table.status),
    index("idx_payment_sessions_status_created").on(table.status, table.createdAt),
    index("idx_payment_sessions_provider").on(table.provider),
    index("idx_payment_sessions_provider_created").on(table.provider, table.createdAt),
    index("idx_payment_sessions_provider_session").on(table.providerSessionId),
    index("idx_payment_sessions_expires_at").on(table.expiresAt),
    uniqueIndex("uidx_payment_sessions_idempotency").on(table.idempotencyKey),
    uniqueIndex("uidx_payment_sessions_provider_session").on(
      table.provider,
      table.providerSessionId,
    ),
  ],
)

export type PaymentSession = typeof paymentSessions.$inferSelect
export type NewPaymentSession = typeof paymentSessions.$inferInsert

// ---------- payment_authorizations ----------

export const paymentAuthorizations = pgTable(
  "payment_authorizations",
  {
    id: typeId("payment_authorizations"),
    bookingId: text("booking_id"),
    orderId: text("order_id"),
    invoiceId: typeIdRef("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    bookingGuaranteeId: typeIdRef("booking_guarantee_id"),
    paymentInstrumentId: typeIdRef("payment_instrument_id").references(
      () => paymentInstruments.id,
      {
        onDelete: "set null",
      },
    ),
    status: paymentAuthorizationStatusEnum("status").notNull().default("pending"),
    captureMode: captureModeEnum("capture_mode").notNull().default("manual"),
    currency: text("currency").notNull(),
    amountCents: integer("amount_cents").notNull(),
    provider: text("provider"),
    externalAuthorizationId: text("external_authorization_id"),
    approvalCode: text("approval_code"),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_payment_authorizations_booking").on(table.bookingId),
    index("idx_payment_authorizations_booking_created").on(table.bookingId, table.createdAt),
    index("idx_payment_authorizations_order").on(table.orderId),
    index("idx_payment_authorizations_order_created").on(table.orderId, table.createdAt),
    index("idx_payment_authorizations_invoice").on(table.invoiceId),
    index("idx_payment_authorizations_invoice_created").on(table.invoiceId, table.createdAt),
    index("idx_payment_authorizations_guarantee").on(table.bookingGuaranteeId),
    index("idx_payment_authorizations_guarantee_created").on(
      table.bookingGuaranteeId,
      table.createdAt,
    ),
    index("idx_payment_authorizations_instrument").on(table.paymentInstrumentId),
    index("idx_payment_authorizations_instrument_created").on(
      table.paymentInstrumentId,
      table.createdAt,
    ),
    index("idx_payment_authorizations_status").on(table.status),
    index("idx_payment_authorizations_status_created").on(table.status, table.createdAt),
  ],
)

export type PaymentAuthorization = typeof paymentAuthorizations.$inferSelect
export type NewPaymentAuthorization = typeof paymentAuthorizations.$inferInsert

// ---------- payment_captures ----------

export const paymentCaptures = pgTable(
  "payment_captures",
  {
    id: typeId("payment_captures"),
    paymentAuthorizationId: typeIdRef("payment_authorization_id").references(
      () => paymentAuthorizations.id,
      { onDelete: "set null" },
    ),
    invoiceId: typeIdRef("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    status: paymentCaptureStatusEnum("status").notNull().default("pending"),
    currency: text("currency").notNull(),
    amountCents: integer("amount_cents").notNull(),
    provider: text("provider"),
    externalCaptureId: text("external_capture_id"),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_payment_captures_authorization").on(table.paymentAuthorizationId),
    index("idx_payment_captures_authorization_created").on(
      table.paymentAuthorizationId,
      table.createdAt,
    ),
    index("idx_payment_captures_invoice").on(table.invoiceId),
    index("idx_payment_captures_invoice_created").on(table.invoiceId, table.createdAt),
    index("idx_payment_captures_status").on(table.status),
    index("idx_payment_captures_status_created").on(table.status, table.createdAt),
  ],
)

export type PaymentCapture = typeof paymentCaptures.$inferSelect
export type NewPaymentCapture = typeof paymentCaptures.$inferInsert

// ---------- booking_payment_schedules ----------

export const bookingPaymentSchedules = pgTable(
  "booking_payment_schedules",
  {
    id: typeId("booking_payment_schedules"),
    bookingId: text("booking_id").notNull(),
    bookingItemId: text("booking_item_id"),
    scheduleType: paymentScheduleTypeEnum("schedule_type").notNull().default("balance"),
    status: paymentScheduleStatusEnum("status").notNull().default("pending"),
    dueDate: date("due_date").notNull(),
    currency: text("currency").notNull(),
    amountCents: integer("amount_cents").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_payment_schedules_booking").on(table.bookingId),
    index("idx_booking_payment_schedules_booking_due_created").on(
      table.bookingId,
      table.dueDate,
      table.createdAt,
    ),
    index("idx_booking_payment_schedules_item").on(table.bookingItemId),
    index("idx_booking_payment_schedules_status").on(table.status),
    index("idx_booking_payment_schedules_due_date").on(table.dueDate),
  ],
)

export type BookingPaymentSchedule = typeof bookingPaymentSchedules.$inferSelect
export type NewBookingPaymentSchedule = typeof bookingPaymentSchedules.$inferInsert

// ---------- booking_guarantees ----------

export const bookingGuarantees = pgTable(
  "booking_guarantees",
  {
    id: typeId("booking_guarantees"),
    bookingId: text("booking_id").notNull(),
    bookingPaymentScheduleId: typeIdRef("booking_payment_schedule_id").references(
      () => bookingPaymentSchedules.id,
      { onDelete: "set null" },
    ),
    bookingItemId: text("booking_item_id"),
    guaranteeType: guaranteeTypeEnum("guarantee_type").notNull(),
    status: guaranteeStatusEnum("status").notNull().default("pending"),
    paymentInstrumentId: typeIdRef("payment_instrument_id").references(
      () => paymentInstruments.id,
      {
        onDelete: "set null",
      },
    ),
    paymentAuthorizationId: typeIdRef("payment_authorization_id").references(
      () => paymentAuthorizations.id,
      { onDelete: "set null" },
    ),
    currency: text("currency"),
    amountCents: integer("amount_cents"),
    provider: text("provider"),
    referenceNumber: text("reference_number"),
    guaranteedAt: timestamp("guaranteed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_guarantees_booking").on(table.bookingId),
    index("idx_booking_guarantees_booking_created").on(table.bookingId, table.createdAt),
    index("idx_booking_guarantees_schedule").on(table.bookingPaymentScheduleId),
    index("idx_booking_guarantees_item").on(table.bookingItemId),
    index("idx_booking_guarantees_instrument").on(table.paymentInstrumentId),
    index("idx_booking_guarantees_authorization").on(table.paymentAuthorizationId),
    index("idx_booking_guarantees_status").on(table.status),
    check(
      "ck_booking_guarantees_currency_amount",
      sql`(${table.currency} IS NULL) = (${table.amountCents} IS NULL)`,
    ),
  ],
)

export type BookingGuarantee = typeof bookingGuarantees.$inferSelect
export type NewBookingGuarantee = typeof bookingGuarantees.$inferInsert

// ---------- booking_item_tax_lines ----------

export const bookingItemTaxLines = pgTable(
  "booking_item_tax_lines",
  {
    id: typeId("booking_item_tax_lines"),
    bookingItemId: text("booking_item_id").notNull(),
    code: text("code"),
    name: text("name").notNull(),
    jurisdiction: text("jurisdiction"),
    scope: taxScopeEnum("scope").notNull().default("excluded"),
    currency: text("currency").notNull(),
    amountCents: integer("amount_cents").notNull(),
    rateBasisPoints: integer("rate_basis_points"),
    includedInPrice: boolean("included_in_price").notNull().default(false),
    remittanceParty: text("remittance_party"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_item_tax_lines_item").on(table.bookingItemId),
    index("idx_booking_item_tax_lines_item_sort_created").on(
      table.bookingItemId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_booking_item_tax_lines_scope").on(table.scope),
  ],
)

export type BookingItemTaxLine = typeof bookingItemTaxLines.$inferSelect
export type NewBookingItemTaxLine = typeof bookingItemTaxLines.$inferInsert

// ---------- booking_item_commissions ----------

export const bookingItemCommissions = pgTable(
  "booking_item_commissions",
  {
    id: typeId("booking_item_commissions"),
    bookingItemId: text("booking_item_id").notNull(),
    channelId: text("channel_id"),
    recipientType: commissionRecipientTypeEnum("recipient_type").notNull(),
    commissionModel: commissionModelEnum("commission_model").notNull().default("percentage"),
    currency: text("currency"),
    amountCents: integer("amount_cents"),
    rateBasisPoints: integer("rate_basis_points"),
    status: commissionStatusEnum("status").notNull().default("pending"),
    payableAt: date("payable_at"),
    paidAt: date("paid_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_item_commissions_item").on(table.bookingItemId),
    index("idx_booking_item_commissions_item_created").on(table.bookingItemId, table.createdAt),
    index("idx_booking_item_commissions_channel").on(table.channelId),
    index("idx_booking_item_commissions_status").on(table.status),
    check(
      "ck_booking_item_commissions_currency_amount",
      sql`(${table.currency} IS NULL) = (${table.amountCents} IS NULL)`,
    ),
  ],
)

export type BookingItemCommission = typeof bookingItemCommissions.$inferSelect
export type NewBookingItemCommission = typeof bookingItemCommissions.$inferInsert

// ---------- invoices ----------

export const invoices = pgTable(
  "invoices",
  {
    id: typeId("invoices"),

    invoiceNumber: text("invoice_number").notNull(),
    invoiceType: invoiceTypeEnum("invoice_type").notNull().default("invoice"),
    /**
     * Source proforma when this row is the final invoice that
     * superseded one. Lets the bank-transfer flow link the proforma
     * issued at checkout to the invoice issued after payment lands —
     * SmartBill's "convert proforma" call returns the same number
     * series, but the local rows stay distinct so the audit trail
     * shows both documents.
     */
    convertedFromInvoiceId: text("converted_from_invoice_id"),
    seriesId: typeIdRef("series_id"),
    sequence: integer("sequence"),
    templateId: typeIdRef("template_id"),
    taxRegimeId: typeIdRef("tax_regime_id"),
    language: text("language"),
    bookingId: text("booking_id").notNull(),
    personId: text("person_id"),
    organizationId: text("organization_id"),
    status: invoiceStatusEnum("status").notNull().default("draft"),

    currency: text("currency").notNull(),
    baseCurrency: text("base_currency"),
    fxRateSetId: text("fx_rate_set_id"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    baseSubtotalCents: integer("base_subtotal_cents"),
    taxCents: integer("tax_cents").notNull().default(0),
    baseTaxCents: integer("base_tax_cents"),
    totalCents: integer("total_cents").notNull().default(0),
    baseTotalCents: integer("base_total_cents"),
    paidCents: integer("paid_cents").notNull().default(0),
    basePaidCents: integer("base_paid_cents"),
    balanceDueCents: integer("balance_due_cents").notNull().default(0),
    baseBalanceDueCents: integer("base_balance_due_cents"),
    commissionPercent: integer("commission_percent"),
    commissionAmountCents: integer("commission_amount_cents"),

    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    notes: text("notes"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoices_booking").on(table.bookingId),
    index("idx_invoices_booking_created").on(table.bookingId, table.createdAt),
    index("idx_invoices_person").on(table.personId),
    index("idx_invoices_organization").on(table.organizationId),
    index("idx_invoices_status").on(table.status),
    index("idx_invoices_status_created").on(table.status, table.createdAt),
    index("idx_invoices_fx_rate_set").on(table.fxRateSetId),
    index("idx_invoices_number").on(table.invoiceNumber),
    uniqueIndex("invoices_invoice_number_type_active_idx")
      .on(table.invoiceNumber, table.invoiceType)
      .where(sql`${table.status} <> 'void'`),
    index("idx_invoices_due_date").on(table.dueDate),
    index("idx_invoices_converted_from").on(table.convertedFromInvoiceId),
    // base_currency covers every base_*_cents column. If any base amount is
    // present, base_currency must be set so reporting can interpret it.
    check(
      "ck_invoices_base_currency_amounts",
      sql`(
        ${table.baseSubtotalCents} IS NULL
        AND ${table.baseTaxCents} IS NULL
        AND ${table.baseTotalCents} IS NULL
        AND ${table.basePaidCents} IS NULL
        AND ${table.baseBalanceDueCents} IS NULL
      ) OR ${table.baseCurrency} IS NOT NULL`,
    ),
  ],
)

export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert

// ---------- invoice_line_items ----------

export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: typeId("invoice_line_items"),
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    bookingItemId: text("booking_item_id"),
    bookingPaymentScheduleId: text("booking_payment_schedule_id").references(
      () => bookingPaymentSchedules.id,
      { onDelete: "set null" },
    ),

    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    taxRate: integer("tax_rate"),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoice_line_items_invoice").on(table.invoiceId),
    index("idx_invoice_line_items_invoice_sort").on(table.invoiceId, table.sortOrder),
    index("idx_invoice_line_items_booking_item").on(table.bookingItemId),
    index("idx_invoice_line_items_payment_schedule").on(table.bookingPaymentScheduleId),
  ],
)

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert

// ---------- payments ----------

export const payments = pgTable(
  "payments",
  {
    id: typeId("payments"),
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),

    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    baseCurrency: text("base_currency"),
    baseAmountCents: integer("base_amount_cents"),
    fxRateSetId: text("fx_rate_set_id"),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentInstrumentId: typeIdRef("payment_instrument_id").references(
      () => paymentInstruments.id,
      {
        onDelete: "set null",
      },
    ),
    paymentAuthorizationId: typeIdRef("payment_authorization_id").references(
      () => paymentAuthorizations.id,
      { onDelete: "set null" },
    ),
    paymentCaptureId: typeIdRef("payment_capture_id").references(() => paymentCaptures.id, {
      onDelete: "set null",
    }),
    status: paymentStatusEnum("status").notNull().default("pending"),
    referenceNumber: text("reference_number"),
    paymentDate: date("payment_date").notNull(),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_payments_invoice").on(table.invoiceId),
    index("idx_payments_invoice_date").on(table.invoiceId, table.paymentDate),
    index("idx_payments_fx_rate_set").on(table.fxRateSetId),
    index("idx_payments_instrument").on(table.paymentInstrumentId),
    index("idx_payments_authorization").on(table.paymentAuthorizationId),
    index("idx_payments_capture").on(table.paymentCaptureId),
    index("idx_payments_status").on(table.status),
    index("idx_payments_date").on(table.paymentDate),
    check(
      "ck_payments_base_currency_amount",
      sql`(${table.baseCurrency} IS NULL) = (${table.baseAmountCents} IS NULL)`,
    ),
  ],
)

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert

// ---------- credit_notes ----------

export const creditNotes = pgTable(
  "credit_notes",
  {
    id: typeId("credit_notes"),

    creditNoteNumber: text("credit_note_number").notNull().unique(),
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    status: creditNoteStatusEnum("status").notNull().default("draft"),

    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    baseCurrency: text("base_currency"),
    baseAmountCents: integer("base_amount_cents"),
    fxRateSetId: text("fx_rate_set_id"),
    reason: text("reason").notNull(),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_credit_notes_invoice").on(table.invoiceId),
    index("idx_credit_notes_invoice_created").on(table.invoiceId, table.createdAt),
    index("idx_credit_notes_fx_rate_set").on(table.fxRateSetId),
    index("idx_credit_notes_number").on(table.creditNoteNumber),
  ],
)

export type CreditNote = typeof creditNotes.$inferSelect
export type NewCreditNote = typeof creditNotes.$inferInsert

// ---------- credit_note_line_items ----------

export const creditNoteLineItems = pgTable(
  "credit_note_line_items",
  {
    id: typeId("credit_note_line_items"),
    creditNoteId: typeIdRef("credit_note_id")
      .notNull()
      .references(() => creditNotes.id, { onDelete: "cascade" }),

    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_credit_note_line_items_credit_note").on(table.creditNoteId),
    index("idx_credit_note_line_items_credit_note_sort").on(table.creditNoteId, table.sortOrder),
  ],
)

export type CreditNoteLineItem = typeof creditNoteLineItems.$inferSelect
export type NewCreditNoteLineItem = typeof creditNoteLineItems.$inferInsert

// ---------- supplier_payments ----------

export const supplierPayments = pgTable(
  "supplier_payments",
  {
    id: typeId("supplier_payments"),

    // AP payments may settle a whole supplier invoice (no single booking) or a
    // booking-scoped supplier service. At least one of bookingId /
    // supplierInvoiceId must be set (check below). See §5.4.
    bookingId: text("booking_id"),
    supplierId: text("supplier_id"),
    bookingSupplierStatusId: text("booking_supplier_status_id"),
    // Finance-local → REAL FK. The supplier invoice this payment settles.
    supplierInvoiceId: typeIdRef("supplier_invoice_id").references(() => supplierInvoices.id, {
      onDelete: "set null",
    }),

    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    baseCurrency: text("base_currency"),
    baseAmountCents: integer("base_amount_cents"),
    fxRateSetId: text("fx_rate_set_id"),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentInstrumentId: typeIdRef("payment_instrument_id").references(
      () => paymentInstruments.id,
      {
        onDelete: "set null",
      },
    ),
    status: paymentStatusEnum("status").notNull().default("pending"),
    referenceNumber: text("reference_number"),
    paymentDate: date("payment_date").notNull(),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_supplier_payments_booking").on(table.bookingId),
    index("idx_supplier_payments_booking_created").on(table.bookingId, table.createdAt),
    index("idx_supplier_payments_supplier").on(table.supplierId),
    index("idx_supplier_payments_supplier_created").on(table.supplierId, table.createdAt),
    index("idx_supplier_payments_fx_rate_set").on(table.fxRateSetId),
    index("idx_supplier_payments_instrument").on(table.paymentInstrumentId),
    index("idx_supplier_payments_status").on(table.status),
    index("idx_supplier_payments_status_created").on(table.status, table.createdAt),
    index("idx_supplier_payments_date").on(table.paymentDate),
    index("idx_supplier_payments_supplier_invoice").on(table.supplierInvoiceId),
    // A payment must attach to a booking and/or a supplier invoice (§5.4).
    check(
      "ck_supplier_payments_target",
      sql`${table.bookingId} IS NOT NULL OR ${table.supplierInvoiceId} IS NOT NULL`,
    ),
  ],
)

export type SupplierPayment = typeof supplierPayments.$inferSelect
export type NewSupplierPayment = typeof supplierPayments.$inferInsert

// ---------- supplier_invoices (accounts payable) ----------
// Sibling of `invoices` (AR), NOT a direction flag on it — see
// docs/architecture/supplier-invoices-profitability.md §4.1 / §5.1.

export const supplierInvoices = pgTable(
  "supplier_invoices",
  {
    id: typeId("supplier_invoices"),

    // Cross-module reference → plain indexed text (§4.3). Which supplier billed us.
    supplierId: text("supplier_id").notNull(),
    // The SUPPLIER's invoice number (their document). Unique per supplier, not global.
    supplierInvoiceNo: text("supplier_invoice_no").notNull(),
    // Optional internal AP reference / our own series, when an operator wants one.
    internalRef: text("internal_ref"),
    status: supplierInvoiceStatusEnum("status").notNull().default("draft"),

    currency: text("currency").notNull(),
    baseCurrency: text("base_currency"),
    fxRateSetId: text("fx_rate_set_id"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    paidCents: integer("paid_cents").notNull().default(0),
    balanceDueCents: integer("balance_due_cents").notNull().default(0),
    // Reuses tax_regimes — supports reverse_charge for cross-border supply.
    taxRegimeId: typeIdRef("tax_regime_id"),

    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by"),

    // Attached PDF — matches the invoices/invoice_attachments `storageKey`
    // convention (§5.1), NOT a media id.
    storageKey: text("storage_key"),
    // FK to a future invoice_extractions row (PR5); plain text for now.
    extractionId: text("extraction_id"),

    notes: text("notes"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_supplier_invoices_supplier").on(table.supplierId),
    index("idx_supplier_invoices_supplier_created").on(table.supplierId, table.createdAt),
    index("idx_supplier_invoices_status").on(table.status),
    index("idx_supplier_invoices_status_created").on(table.status, table.createdAt),
    index("idx_supplier_invoices_due_date").on(table.dueDate),
    index("idx_supplier_invoices_fx_rate_set").on(table.fxRateSetId),
    // The supplier's number is unique per supplier (AP convention), ignoring voids.
    uniqueIndex("supplier_invoices_supplier_number_active_idx")
      .on(table.supplierId, table.supplierInvoiceNo)
      .where(sql`${table.status} <> 'void' AND ${table.deletedAt} IS NULL`),
    // If any base amount is present, base_currency must be set (mirrors invoices).
    check(
      "ck_supplier_invoices_base_currency",
      sql`${table.baseCurrency} IS NOT NULL OR ${table.fxRateSetId} IS NULL`,
    ),
  ],
)

export type SupplierInvoice = typeof supplierInvoices.$inferSelect
export type NewSupplierInvoice = typeof supplierInvoices.$inferInsert

// ---------- supplier_invoice_lines ----------

export const supplierInvoiceLines = pgTable(
  "supplier_invoice_lines",
  {
    id: typeId("supplier_invoice_lines"),
    // Finance-local → REAL FK (§4.3).
    supplierInvoiceId: typeIdRef("supplier_invoice_id")
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: "cascade" }),

    description: text("description").notNull(),
    serviceType: apServiceTypeEnum("service_type").notNull().default("other"),
    // Cross-module → plain text ref to supplier_services (no FK).
    supplierServiceId: text("supplier_service_id"),

    quantity: integer("quantity").notNull().default(1),
    unitAmountCents: integer("unit_amount_cents").notNull(),
    taxRateBps: integer("tax_rate_bps"),
    taxAmountCents: integer("tax_amount_cents").notNull().default(0),
    totalAmountCents: integer("total_amount_cents").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_supplier_invoice_lines_invoice").on(table.supplierInvoiceId),
    index("idx_supplier_invoice_lines_invoice_sort").on(table.supplierInvoiceId, table.sortOrder),
    index("idx_supplier_invoice_lines_service_type").on(table.serviceType),
  ],
)

export type SupplierInvoiceLine = typeof supplierInvoiceLines.$inferSelect
export type NewSupplierInvoiceLine = typeof supplierInvoiceLines.$inferInsert

// ---------- supplier_cost_allocations ----------
// Attributes a line (or whole invoice) to a departure / product / booking /
// traveller. A line may split across many allocations (§6). Invariants are
// enforced in the service layer (§6.1).

export const supplierCostAllocations = pgTable(
  "supplier_cost_allocations",
  {
    id: typeId("supplier_cost_allocations"),
    // Finance-local → REAL FKs (§4.3).
    supplierInvoiceId: typeIdRef("supplier_invoice_id")
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: "cascade" }),
    // Null = allocates the whole invoice (line-less mode).
    supplierInvoiceLineId: typeIdRef("supplier_invoice_line_id").references(
      () => supplierInvoiceLines.id,
      { onDelete: "cascade" },
    ),

    targetType: costAllocationTargetTypeEnum("target_type").notNull(),
    // Cross-module target refs → plain indexed text (§4.3). Exactly one is set
    // per row to match `targetType` (check constraint below + service guard).
    departureId: text("departure_id"),
    productId: text("product_id"),
    bookingId: text("booking_id"),
    bookingItemId: text("booking_item_id"),
    travelerId: text("traveler_id"),

    amountCents: integer("amount_cents").notNull(),
    baseAmountCents: integer("base_amount_cents"),
    splitMethod: costAllocationSplitMethodEnum("split_method").notNull().default("manual"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_supplier_cost_allocations_invoice").on(table.supplierInvoiceId),
    index("idx_supplier_cost_allocations_line").on(table.supplierInvoiceLineId),
    index("idx_supplier_cost_allocations_departure").on(table.departureId),
    index("idx_supplier_cost_allocations_product").on(table.productId),
    index("idx_supplier_cost_allocations_booking").on(table.bookingId),
    // Exactly one target id is set, and it matches `target_type` (§6.1 rule 2).
    check(
      "ck_supplier_cost_allocations_one_target",
      sql`(
        (${table.targetType} = 'departure' AND ${table.departureId} IS NOT NULL AND ${table.productId} IS NULL AND ${table.bookingId} IS NULL AND ${table.bookingItemId} IS NULL AND ${table.travelerId} IS NULL)
        OR (${table.targetType} = 'product' AND ${table.productId} IS NOT NULL AND ${table.departureId} IS NULL AND ${table.bookingId} IS NULL AND ${table.bookingItemId} IS NULL AND ${table.travelerId} IS NULL)
        OR (${table.targetType} = 'booking' AND ${table.bookingId} IS NOT NULL AND ${table.departureId} IS NULL AND ${table.productId} IS NULL AND ${table.travelerId} IS NULL)
        OR (${table.targetType} = 'traveler' AND ${table.travelerId} IS NOT NULL AND ${table.departureId} IS NULL AND ${table.productId} IS NULL)
        OR (${table.targetType} = 'unattributed' AND ${table.departureId} IS NULL AND ${table.productId} IS NULL AND ${table.bookingId} IS NULL AND ${table.bookingItemId} IS NULL AND ${table.travelerId} IS NULL)
      )`,
    ),
  ],
)

export type SupplierCostAllocation = typeof supplierCostAllocations.$inferSelect
export type NewSupplierCostAllocation = typeof supplierCostAllocations.$inferInsert

// ---------- finance_notes ----------

export const financeNotes = pgTable(
  "finance_notes",
  {
    id: typeId("finance_notes"),
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_finance_notes_invoice").on(table.invoiceId),
    index("idx_finance_notes_invoice_created").on(table.invoiceId, table.createdAt),
  ],
)

export type FinanceNote = typeof financeNotes.$inferSelect
export type NewFinanceNote = typeof financeNotes.$inferInsert

// ---------- invoice_number_series ----------

export const invoiceNumberSeries = pgTable(
  "invoice_number_series",
  {
    id: typeId("invoice_number_series"),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    prefix: text("prefix").notNull().default(""),
    separator: text("separator").notNull().default(""),
    padLength: integer("pad_length").notNull().default(4),
    currentSequence: integer("current_sequence").notNull().default(0),
    resetStrategy: invoiceNumberResetStrategyEnum("reset_strategy").notNull().default("never"),
    resetAt: timestamp("reset_at", { withTimezone: true }),
    scope: invoiceNumberSeriesScopeEnum("scope").notNull().default("invoice"),
    isDefault: boolean("is_default").notNull().default(false),
    externalProvider: text("external_provider"),
    externalConfigKey: text("external_config_key"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoice_number_series_scope").on(table.scope),
    index("idx_invoice_number_series_active").on(table.active),
    index("idx_invoice_number_series_scope_default").on(table.scope, table.isDefault),
    index("idx_invoice_number_series_external_provider").on(table.externalProvider),
    index("idx_invoice_number_series_scope_updated").on(table.scope, table.updatedAt),
    index("idx_invoice_number_series_active_updated").on(table.active, table.updatedAt),
    uniqueIndex("uidx_invoice_number_series_default_scope_active")
      .on(table.scope)
      .where(sql`${table.active} = true AND ${table.isDefault} = true`),
  ],
)

export type InvoiceNumberSeries = typeof invoiceNumberSeries.$inferSelect
export type NewInvoiceNumberSeries = typeof invoiceNumberSeries.$inferInsert

// ---------- invoice_templates ----------

export const invoiceTemplates = pgTable(
  "invoice_templates",
  {
    id: typeId("invoice_templates"),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    language: text("language").notNull().default("en"),
    jurisdiction: text("jurisdiction"),
    bodyFormat: invoiceTemplateBodyFormatEnum("body_format").notNull().default("html"),
    body: text("body").notNull(),
    cssStyles: text("css_styles"),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoice_templates_language").on(table.language),
    index("idx_invoice_templates_language_updated").on(table.language, table.updatedAt),
    index("idx_invoice_templates_jurisdiction").on(table.jurisdiction),
    index("idx_invoice_templates_jurisdiction_updated").on(table.jurisdiction, table.updatedAt),
    index("idx_invoice_templates_default").on(table.isDefault),
    index("idx_invoice_templates_default_updated").on(table.isDefault, table.updatedAt),
    index("idx_invoice_templates_active").on(table.active),
    index("idx_invoice_templates_active_updated").on(table.active, table.updatedAt),
  ],
)

export type InvoiceTemplate = typeof invoiceTemplates.$inferSelect
export type NewInvoiceTemplate = typeof invoiceTemplates.$inferInsert

// ---------- invoice_renditions ----------

export const invoiceRenditions = pgTable(
  "invoice_renditions",
  {
    id: typeId("invoice_renditions"),
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    templateId: typeIdRef("template_id").references(() => invoiceTemplates.id, {
      onDelete: "set null",
    }),
    format: invoiceRenditionFormatEnum("format").notNull().default("pdf"),
    status: invoiceRenditionStatusEnum("status").notNull().default("pending"),
    storageKey: text("storage_key"),
    fileSize: integer("file_size"),
    checksum: text("checksum"),
    language: text("language"),
    errorMessage: text("error_message"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoice_renditions_invoice").on(table.invoiceId),
    index("idx_invoice_renditions_invoice_created").on(table.invoiceId, table.createdAt),
    index("idx_invoice_renditions_template").on(table.templateId),
    index("idx_invoice_renditions_status").on(table.status),
    index("idx_invoice_renditions_format").on(table.format),
  ],
)

export type InvoiceRendition = typeof invoiceRenditions.$inferSelect
export type NewInvoiceRendition = typeof invoiceRenditions.$inferInsert

// ---------- invoice_attachments ----------

export const invoiceAttachments = pgTable(
  "invoice_attachments",
  {
    id: typeId("invoice_attachments"),
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("supporting_document"),
    name: text("name").notNull(),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    storageKey: text("storage_key"),
    checksum: text("checksum"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoice_attachments_invoice").on(table.invoiceId),
    index("idx_invoice_attachments_invoice_created").on(table.invoiceId, table.createdAt),
  ],
)

export type InvoiceAttachment = typeof invoiceAttachments.$inferSelect
export type NewInvoiceAttachment = typeof invoiceAttachments.$inferInsert

// ---------- tax_regimes ----------

export const taxRegimes = pgTable(
  "tax_regimes",
  {
    id: typeId("tax_regimes"),
    code: taxRegimeCodeEnum("code").notNull(),
    name: text("name").notNull(),
    jurisdiction: text("jurisdiction"),
    ratePercent: integer("rate_percent"),
    description: text("description"),
    legalReference: text("legal_reference"),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tax_regimes_code").on(table.code),
    index("idx_tax_regimes_code_updated").on(table.code, table.updatedAt),
    index("idx_tax_regimes_jurisdiction").on(table.jurisdiction),
    index("idx_tax_regimes_jurisdiction_updated").on(table.jurisdiction, table.updatedAt),
    index("idx_tax_regimes_active").on(table.active),
    index("idx_tax_regimes_active_updated").on(table.active, table.updatedAt),
  ],
)

export type TaxRegime = typeof taxRegimes.$inferSelect
export type NewTaxRegime = typeof taxRegimes.$inferInsert

// ---------- tax_classes ----------
//
// Per-product tax-treatment decision. Stacks on top of `tax_regimes`
// (the jurisdictional rate catalog) — a class points at a default
// regime, plus optional regime-per-applies_to overrides for products
// that mix base / addon / accommodation treatments.
//
// Per booking-journey-architecture §9.

export const taxClassAppliesToEnum = pgEnum("tax_class_applies_to", [
  "base",
  "addon",
  "accommodation",
  "all",
])

export const taxPolicySideEnum = pgEnum("tax_policy_side", ["sell", "buy"])

export const taxClasses = pgTable(
  "tax_classes",
  {
    id: typeId("tax_classes"),
    /** Stable code for idempotent seeding (e.g. "vat-standard-ro",
     *  "exempt-art311", "reduced-de"). */
    code: text("code").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    /** Default regime resolved at quote time when no per-line rule
     *  matches. Plain text — cross-domain refs go through link service
     *  per schema-discipline. */
    defaultRegimeId: text("default_regime_id"),
    /**
     * Regime-per-applies_to overrides. Empty / null falls through to
     * `default_regime_id`. Parsed at quote time by the engine.
     */
    lines:
      jsonb("lines").$type<
        Array<{
          regime_id: string
          applies_to: "base" | "addon" | "accommodation" | "all"
        }>
      >(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tax_classes_code").on(table.code),
    index("idx_tax_classes_active").on(table.active),
  ],
)

export type TaxClass = typeof taxClasses.$inferSelect
export type NewTaxClass = typeof taxClasses.$inferInsert

// ---------- tax_policy_profiles ----------
//
// Operator/jurisdiction-specific tax decision profiles. Profiles are
// implementation presets such as "Romanian travel operator"; rules under
// the profile map product/order facts to tax regimes for sell-side and
// buy-side tax decisions.

export const taxPolicyProfiles = pgTable(
  "tax_policy_profiles",
  {
    id: typeId("tax_policy_profiles"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    jurisdiction: text("jurisdiction"),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tax_policy_profiles_code").on(table.code),
    index("idx_tax_policy_profiles_active").on(table.active),
  ],
)

export type TaxPolicyProfile = typeof taxPolicyProfiles.$inferSelect
export type NewTaxPolicyProfile = typeof taxPolicyProfiles.$inferInsert

export const taxPolicyRules = pgTable(
  "tax_policy_rules",
  {
    id: typeId("tax_policy_rules"),
    profileId: text("profile_id").notNull(),
    side: taxPolicySideEnum("side").notNull().default("sell"),
    priority: integer("priority").notNull().default(100),
    name: text("name").notNull(),
    appliesTo: taxClassAppliesToEnum("applies_to").notNull().default("all"),
    condition: jsonb("condition").$type<Record<string, unknown>>(),
    taxRegimeId: text("tax_regime_id").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tax_policy_rules_profile").on(table.profileId),
    index("idx_tax_policy_rules_profile_side_priority").on(
      table.profileId,
      table.side,
      table.priority,
    ),
    index("idx_tax_policy_rules_active").on(table.active),
  ],
)

export type TaxPolicyRule = typeof taxPolicyRules.$inferSelect
export type NewTaxPolicyRule = typeof taxPolicyRules.$inferInsert

// ---------- invoice_external_refs ----------

export const invoiceExternalRefs = pgTable(
  "invoice_external_refs",
  {
    id: typeId("invoice_external_refs"),
    invoiceId: typeIdRef("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalId: text("external_id"),
    externalNumber: text("external_number"),
    externalUrl: text("external_url"),
    status: text("status"),
    metadata: jsonb("metadata"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    syncError: text("sync_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoice_external_refs_invoice").on(table.invoiceId),
    index("idx_invoice_external_refs_invoice_created").on(table.invoiceId, table.createdAt),
    index("idx_invoice_external_refs_provider").on(table.provider),
    uniqueIndex("uq_invoice_external_refs_invoice_provider").on(table.invoiceId, table.provider),
  ],
)

export type InvoiceExternalRef = typeof invoiceExternalRefs.$inferSelect
export type NewInvoiceExternalRef = typeof invoiceExternalRefs.$inferInsert

// ---------- relations ----------

export const invoicesRelations = relations(invoices, ({ many }) => ({
  lineItems: many(invoiceLineItems),
  payments: many(payments),
  creditNotes: many(creditNotes),
  notes: many(financeNotes),
  authorizations: many(paymentAuthorizations),
  captures: many(paymentCaptures),
  renditions: many(invoiceRenditions),
  attachments: many(invoiceAttachments),
}))

export const paymentInstrumentsRelations = relations(paymentInstruments, ({ many }) => ({
  guarantees: many(bookingGuarantees),
  payments: many(payments),
  supplierPayments: many(supplierPayments),
  authorizations: many(paymentAuthorizations),
}))

export const paymentAuthorizationsRelations = relations(paymentAuthorizations, ({ one, many }) => ({
  invoice: one(invoices, {
    fields: [paymentAuthorizations.invoiceId],
    references: [invoices.id],
  }),
  paymentInstrument: one(paymentInstruments, {
    fields: [paymentAuthorizations.paymentInstrumentId],
    references: [paymentInstruments.id],
  }),
  bookingGuarantee: one(bookingGuarantees, {
    fields: [paymentAuthorizations.bookingGuaranteeId],
    references: [bookingGuarantees.id],
    relationName: "guarantee_authorization",
  }),
  captures: many(paymentCaptures),
  payments: many(payments),
}))

export const paymentCapturesRelations = relations(paymentCaptures, ({ one, many }) => ({
  paymentAuthorization: one(paymentAuthorizations, {
    fields: [paymentCaptures.paymentAuthorizationId],
    references: [paymentAuthorizations.id],
  }),
  invoice: one(invoices, {
    fields: [paymentCaptures.invoiceId],
    references: [invoices.id],
  }),
  payments: many(payments),
}))

export const bookingPaymentSchedulesRelations = relations(bookingPaymentSchedules, ({ many }) => ({
  guarantees: many(bookingGuarantees),
}))

export const bookingGuaranteesRelations = relations(bookingGuarantees, ({ one }) => ({
  bookingPaymentSchedule: one(bookingPaymentSchedules, {
    fields: [bookingGuarantees.bookingPaymentScheduleId],
    references: [bookingPaymentSchedules.id],
  }),
  paymentInstrument: one(paymentInstruments, {
    fields: [bookingGuarantees.paymentInstrumentId],
    references: [paymentInstruments.id],
  }),
  paymentAuthorization: one(paymentAuthorizations, {
    fields: [bookingGuarantees.paymentAuthorizationId],
    references: [paymentAuthorizations.id],
    relationName: "guarantee_authorization",
  }),
}))

export const bookingItemTaxLinesRelations = relations(bookingItemTaxLines, () => ({}))

export const bookingItemCommissionsRelations = relations(bookingItemCommissions, () => ({}))

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLineItems.invoiceId], references: [invoices.id] }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
  paymentInstrument: one(paymentInstruments, {
    fields: [payments.paymentInstrumentId],
    references: [paymentInstruments.id],
  }),
  paymentAuthorization: one(paymentAuthorizations, {
    fields: [payments.paymentAuthorizationId],
    references: [paymentAuthorizations.id],
  }),
  paymentCapture: one(paymentCaptures, {
    fields: [payments.paymentCaptureId],
    references: [paymentCaptures.id],
  }),
}))

export const creditNotesRelations = relations(creditNotes, ({ one, many }) => ({
  invoice: one(invoices, { fields: [creditNotes.invoiceId], references: [invoices.id] }),
  lineItems: many(creditNoteLineItems),
}))

export const creditNoteLineItemsRelations = relations(creditNoteLineItems, ({ one }) => ({
  creditNote: one(creditNotes, {
    fields: [creditNoteLineItems.creditNoteId],
    references: [creditNotes.id],
  }),
}))

export const supplierPaymentsRelations = relations(supplierPayments, ({ one }) => ({
  paymentInstrument: one(paymentInstruments, {
    fields: [supplierPayments.paymentInstrumentId],
    references: [paymentInstruments.id],
  }),
}))

export const financeNotesRelations = relations(financeNotes, ({ one }) => ({
  invoice: one(invoices, { fields: [financeNotes.invoiceId], references: [invoices.id] }),
}))

export const invoiceRenditionsRelations = relations(invoiceRenditions, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceRenditions.invoiceId], references: [invoices.id] }),
  template: one(invoiceTemplates, {
    fields: [invoiceRenditions.templateId],
    references: [invoiceTemplates.id],
  }),
}))

export const invoiceAttachmentsRelations = relations(invoiceAttachments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceAttachments.invoiceId],
    references: [invoices.id],
  }),
}))

export const invoiceExternalRefsRelations = relations(invoiceExternalRefs, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceExternalRefs.invoiceId],
    references: [invoices.id],
  }),
}))

export const vouchersRelations = relations(vouchers, ({ many }) => ({
  redemptions: many(voucherRedemptions),
}))

export const voucherRedemptionsRelations = relations(voucherRedemptions, ({ one }) => ({
  voucher: one(vouchers, {
    fields: [voucherRedemptions.voucherId],
    references: [vouchers.id],
  }),
}))

export const invoiceNumberSeriesRelations = relations(invoiceNumberSeries, () => ({}))
export const invoiceTemplatesRelations = relations(invoiceTemplates, ({ many }) => ({
  renditions: many(invoiceRenditions),
}))
export const taxRegimesRelations = relations(taxRegimes, () => ({}))
