// AUTO-GENERATED from ./src/links/index.ts - do not edit by hand.
// Run `voyant db schemas --emit` or `voyant db generate` to refresh.
import { sql } from "drizzle-orm"
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

export const crmPersonProductsProductLinkTable = pgTable(
  "crm_person_products_product",
  {
    id: text("id").primaryKey(),
    crmPersonId: text("crm_person_id").notNull(),
    productsProductId: text("products_product_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("crm_person_products_product_pair_idx")
      .on(table.crmPersonId, table.productsProductId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("crm_person_products_product_l_idx")
      .on(table.crmPersonId)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("crm_person_products_product_r_uniq")
      .on(table.productsProductId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
)

export const crmOrganizationProductsProductLinkTable = pgTable(
  "crm_organization_products_product",
  {
    id: text("id").primaryKey(),
    crmOrganizationId: text("crm_organization_id").notNull(),
    productsProductId: text("products_product_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("crm_organization_products_product_pair_idx")
      .on(table.crmOrganizationId, table.productsProductId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("crm_organization_products_product_l_idx")
      .on(table.crmOrganizationId)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("crm_organization_products_product_r_uniq")
      .on(table.productsProductId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
)

export const legalContractBookingsBookingLinkTable = pgTable(
  "legal_contract_bookings_booking",
  {
    id: text("id").primaryKey(),
    legalContractId: text("legal_contract_id").notNull(),
    bookingsBookingId: text("bookings_booking_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("legal_contract_bookings_booking_pair_idx")
      .on(table.legalContractId, table.bookingsBookingId)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("legal_contract_bookings_booking_l_uniq")
      .on(table.legalContractId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("legal_contract_bookings_booking_r_idx")
      .on(table.bookingsBookingId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
)

export const legalContractTransactionsOrderLinkTable = pgTable(
  "legal_contract_transactions_order",
  {
    id: text("id").primaryKey(),
    legalContractId: text("legal_contract_id").notNull(),
    transactionsOrderId: text("transactions_order_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("legal_contract_transactions_order_pair_idx")
      .on(table.legalContractId, table.transactionsOrderId)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("legal_contract_transactions_order_l_uniq")
      .on(table.legalContractId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("legal_contract_transactions_order_r_idx")
      .on(table.transactionsOrderId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
)

export const legalContractFinanceInvoiceLinkTable = pgTable(
  "legal_contract_finance_invoice",
  {
    id: text("id").primaryKey(),
    legalContractId: text("legal_contract_id").notNull(),
    financeInvoiceId: text("finance_invoice_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("legal_contract_finance_invoice_pair_idx")
      .on(table.legalContractId, table.financeInvoiceId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("legal_contract_finance_invoice_l_idx")
      .on(table.legalContractId)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("legal_contract_finance_invoice_r_uniq")
      .on(table.financeInvoiceId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
)

export const legalPolicyProductsProductLinkTable = pgTable(
  "legal_policy_products_product",
  {
    id: text("id").primaryKey(),
    legalPolicyId: text("legal_policy_id").notNull(),
    productsProductId: text("products_product_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("legal_policy_products_product_pair_idx")
      .on(table.legalPolicyId, table.productsProductId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("legal_policy_products_product_l_idx")
      .on(table.legalPolicyId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("legal_policy_products_product_r_idx")
      .on(table.productsProductId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
)

export const legalPolicyAcceptanceBookingsBookingLinkTable = pgTable(
  "legal_policyAcceptance_bookings_booking",
  {
    id: text("id").primaryKey(),
    legalPolicyAcceptanceId: text("legal_policyAcceptance_id").notNull(),
    bookingsBookingId: text("bookings_booking_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("legal_policyAcceptance_bookings_booking_pair_idx")
      .on(table.legalPolicyAcceptanceId, table.bookingsBookingId)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("legal_policyAcceptance_bookings_booking_l_uniq")
      .on(table.legalPolicyAcceptanceId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("legal_policyAcceptance_bookings_booking_r_idx")
      .on(table.bookingsBookingId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
)
