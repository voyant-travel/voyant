import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import {
  apServiceTypeEnum,
  costAllocationSplitMethodEnum,
  costAllocationTargetTypeEnum,
  paymentMethodEnum,
  paymentStatusEnum,
  supplierInvoiceStatusEnum,
} from "./enums.js"
import { paymentInstruments } from "./payment-instruments.js"

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
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
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
    // Operator accounting-base amounts, snapshotted at the FX rate effective on
    // `issueDate` (end-to-end FX §). Null for pre-feature rows (lazy/forward-only)
    // and when the invoice currency has no resolvable rate.
    baseSubtotalCents: integer("base_subtotal_cents"),
    baseTaxCents: integer("base_tax_cents"),
    baseTotalCents: integer("base_total_cents"),
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
    // Every supplier-invoice read path filters `deleted_at IS NULL`
    // (soft delete), so the hot list/filter indexes are partial — smaller
    // and the planner can use them for all of those queries.
    index("idx_supplier_invoices_supplier")
      .on(table.supplierId)
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_supplier_invoices_supplier_created")
      .on(table.supplierId, table.createdAt)
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(sql`${table.deletedAt} IS NULL`),
    // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    index("idx_supplier_invoices_status").on(table.status).where(sql`${table.deletedAt} IS NULL`),
    index("idx_supplier_invoices_status_created")
      .on(table.status, table.createdAt)
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_supplier_invoices_due_date")
      .on(table.dueDate)
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_supplier_invoices_fx_rate_set").on(table.fxRateSetId),
    // The supplier's number is unique per supplier (AP convention), ignoring voids.
    uniqueIndex("supplier_invoices_supplier_number_active_idx")
      .on(table.supplierId, table.supplierInvoiceNo)
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(sql`${table.status} <> 'void' AND ${table.deletedAt} IS NULL`),
    // If any base amount is present, base_currency must be set (mirrors invoices).
    check(
      "ck_supplier_invoices_base_currency",
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
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
    // Operator-configurable cost category (finance-local → real FK). The
    // user-facing classification; `serviceType` is kept for back-compat.
    costCategoryId: typeIdRef("cost_category_id").references(() => costCategories.id, {
      onDelete: "set null",
    }),
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

// ---------- cost_categories ----------
// Operator-configurable cost categories (transportation, accommodation,
// guides/touristic services, …). Selected on supplier-invoice lines and used
// for the per-category cost breakdown in profitability.
export const costCategories = pgTable(
  "cost_categories",
  {
    id: typeId("cost_categories"),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_cost_categories_sort").on(table.sortOrder)],
)

export type CostCategory = typeof costCategories.$inferSelect
export type NewCostCategory = typeof costCategories.$inferInsert

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

// ---------- supplier_invoice_attachments ----------
// Mirrors invoice_attachments: metadata + storageKey for supporting files
// (the received PDF, contracts, proof of payment, …). Bytes live in R2;
// the template owns the upload endpoint.

export const supplierInvoiceAttachments = pgTable(
  "supplier_invoice_attachments",
  {
    id: typeId("supplier_invoice_attachments"),
    supplierInvoiceId: typeIdRef("supplier_invoice_id")
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: "cascade" }),
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
    index("idx_supplier_invoice_attachments_invoice").on(table.supplierInvoiceId),
    index("idx_supplier_invoice_attachments_invoice_created").on(
      table.supplierInvoiceId,
      table.createdAt,
    ),
  ],
)

export type SupplierInvoiceAttachment = typeof supplierInvoiceAttachments.$inferSelect
export type NewSupplierInvoiceAttachment = typeof supplierInvoiceAttachments.$inferInsert
