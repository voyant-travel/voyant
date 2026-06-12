import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import {
  captureModeEnum,
  paymentAuthorizationStatusEnum,
  paymentCaptureStatusEnum,
} from "./enums.js"
import { paymentInstruments } from "./payment-instruments.js"
import { invoices } from "./receivables.js"

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
