/**
 * Operator-template-local drizzle schema.
 *
 * Most domain tables live in shared `@voyantjs/*` packages. This file
 * is only for tables that are deployment-flavored — things every
 * operator instance needs but that don't make sense as a generic
 * Voyant module. Right now: the operator profile + default customer
 * payment policy.
 */

import { typeId } from "@voyantjs/db/lib/typeid-column"
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Single-row table holding the deployment's operator profile + the
 * deployment's default customer payment policy. Surfaced in the
 * admin Settings → Operator page.
 *
 * "Operator" is intentionally the neutral term here — the deployment
 * owner could be a tour agency, a hotel, a cruise line, an airline,
 * a DMC, etc. Using "agency" would lie when a hotel adopts Voyant.
 *
 * Why not env vars: operator identity (VAT id, IBAN, signatory) and
 * customer payment terms are admin concerns, not developer concerns.
 * Operators expect to edit these from the dashboard, not by SSHing
 * into a Cloudflare worker config.
 *
 * Why not a generic `settings` package: deployments diverge on what
 * they want to configure. Keeping this in-template lets the operator
 * template own its own settings shape without forcing the same one on
 * every Voyant deployment.
 *
 * Single-row enforcement: handled at the API layer — the GET reads
 * the first row, the PATCH upserts.
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

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type OperatorSettings = typeof operatorSettings.$inferSelect
export type NewOperatorSettings = typeof operatorSettings.$inferInsert
