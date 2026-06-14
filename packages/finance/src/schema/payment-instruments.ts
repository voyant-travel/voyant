import { typeId } from "@voyant-travel/db/lib/typeid-column"
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import {
  paymentInstrumentOwnerTypeEnum,
  paymentInstrumentStatusEnum,
  paymentInstrumentTypeEnum,
} from "./enums.js"

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
