/**
 * Operator-template-local drizzle schema.
 *
 * Most domain tables live in shared `@voyantjs/*` packages. This file
 * is only for tables that are operator-template concerns and do not
 * make sense as generic package-owned domain rows.
 */

import { typeId } from "@voyantjs/db/lib/typeid-column"
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Original catch-all table from the first booking-journey settings
 * pass. Runtime code reads/writes the narrower tables below:
 * `operator_profile`, `operator_payment_instructions`,
 * `operator_payment_defaults`, and `booking_tax_settings`.
 */
export const operatorSettings = pgTable("operator_settings", {
  id: typeId("operator_settings"),

  // Identity
  name: text("name"),
  legalName: text("legal_name"),
  vatId: text("vat_id"),
  registrationNumber: text("registration_number"),

  // Contact
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),

  // Banking
  iban: text("iban"),
  bank: text("bank"),

  // Travel licensing — generic enough to cover tourism authority
  // numbers (ANPC, ABTA, IATA), hotel star-rating registries, and
  // cruise flag-state numbers.
  license: text("license"),
  licenseAuthority: text("license_authority"),

  // Signing officer for contracts (the human whose name appears on
  // the operator-side signature line of a staff-issued contract).
  signatoryName: text("signatory_name"),
  signatoryRole: text("signatory_role"),

  /**
   * Default customer-facing payment policy applied when no per-supplier
   * / per-category / per-listing / per-booking override exists.
   *
   * Shape mirrors the `PaymentPolicy` interface in `@voyantjs/finance`.
   * Stored as jsonb so the shape can evolve (multi-installment plans,
   * grace-period overrides per pax band, etc.) without a migration
   * for every change.
   *
   * `null` means "no policy configured yet — fall through to
   * hard-coded `noDepositPolicy` (100% upfront)".
   */
  customerPaymentPolicy: jsonb("customer_payment_policy"),

  // Columns retained for migrations from pre-booking-tax-settings
  // beta databases. Runtime code reads/writes `booking_tax_settings`.
  taxPriceMode: text("tax_price_mode").notNull().default("inclusive"),
  taxPolicyProfileId: text("tax_policy_profile_id"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type OperatorSettings = typeof operatorSettings.$inferSelect
export type NewOperatorSettings = typeof operatorSettings.$inferInsert

/**
 * Single-row operator profile: the legal/trading identity that
 * contracts with the customer. Used by contract variables and public
 * checkout / booking-preview legal blocks.
 */
export const operatorProfile = pgTable("operator_profile", {
  id: typeId("operator_profile"),
  name: text("name"),
  legalName: text("legal_name"),
  vatId: text("vat_id"),
  registrationNumber: text("registration_number"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  license: text("license"),
  licenseAuthority: text("license_authority"),
  signatoryName: text("signatory_name"),
  signatoryRole: text("signatory_role"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type OperatorProfile = typeof operatorProfile.$inferSelect
export type NewOperatorProfile = typeof operatorProfile.$inferInsert

/**
 * Single-row operator payment instructions for customer-facing
 * collection rails such as bank transfer.
 */
export const operatorPaymentInstructions = pgTable("operator_payment_instructions", {
  id: typeId("operator_payment_instructions"),
  bankTransferBeneficiary: text("bank_transfer_beneficiary"),
  iban: text("iban"),
  bank: text("bank"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type OperatorPaymentInstructions = typeof operatorPaymentInstructions.$inferSelect
export type NewOperatorPaymentInstructions = typeof operatorPaymentInstructions.$inferInsert

/**
 * Single-row operator-level customer payment default. The booking
 * payment-policy cascade uses this only when supplier/category/listing
 * and booking-level policies do not override it.
 */
export const operatorPaymentDefaults = pgTable("operator_payment_defaults", {
  id: typeId("operator_payment_defaults"),
  customerPaymentPolicy: jsonb("customer_payment_policy"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type OperatorPaymentDefaults = typeof operatorPaymentDefaults.$inferSelect
export type NewOperatorPaymentDefaults = typeof operatorPaymentDefaults.$inferInsert

/**
 * Single-row booking tax configuration for booking-create previews,
 * quote recomputation, and booking item tax-line materialization.
 *
 * Kept separate from operator identity and payment instructions:
 * these fields are finance/booking tax policy knobs.
 */
export const bookingTaxSettings = pgTable("booking_tax_settings", {
  id: typeId("booking_tax_settings"),
  taxPriceMode: text("tax_price_mode").notNull().default("inclusive"),
  taxPolicyProfileId: text("tax_policy_profile_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type BookingTaxSettings = typeof bookingTaxSettings.$inferSelect
export type NewBookingTaxSettings = typeof bookingTaxSettings.$inferInsert
