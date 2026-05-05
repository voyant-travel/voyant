/**
 * Operator settings API.
 *
 * Backs the admin Settings → Operator page + the storefront's
 * contract preview operator block. Single-row table, single endpoint
 * family:
 *
 *   GET    /v1/admin/settings/operator  → full row (admin actor only)
 *   PATCH  /v1/admin/settings/operator  → upsert any subset of fields
 *   GET    /v1/public/settings/operator → sanitized subset (no banking,
 *                                         no signatory, no payment policy)
 *
 * The PATCH route auto-creates the row on first call when none
 * exists, so a fresh deployment doesn't need to seed anything.
 *
 * "Operator" is the neutral term across verticals — a tour agency, a
 * hotel, a cruise line, an airline, a DMC are all operators of their
 * Voyant deployment.
 */

import type { PaymentPolicy } from "@voyantjs/finance"
import { parseJsonBody } from "@voyantjs/hono"
import { desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"
import { z } from "zod"

import { operatorSettings } from "../db/schema.js"

const depositRuleSchema = z.object({
  kind: z.enum(["none", "percent", "fixed_cents"]),
  percent: z.number().min(0).max(100).optional(),
  amountCents: z.number().int().min(0).optional(),
})

const paymentPolicySchema = z.object({
  deposit: depositRuleSchema,
  minDaysBeforeDepartureForDeposit: z.number().int().min(0),
  balanceDueDaysBeforeDeparture: z.number().int().min(0),
  balanceDueMinDaysFromNow: z.number().int().min(0),
})

const taxPriceModeSchema = z.enum(["inclusive", "exclusive"])

const updateOperatorSettingsSchema = z.object({
  name: z.string().nullable().optional(),
  legalName: z.string().nullable().optional(),
  vatId: z.string().nullable().optional(),
  registrationNumber: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  website: z.string().url().nullable().optional().or(z.literal("")),
  iban: z.string().nullable().optional(),
  bank: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  licenseAuthority: z.string().nullable().optional(),
  signatoryName: z.string().nullable().optional(),
  signatoryRole: z.string().nullable().optional(),
  customerPaymentPolicy: paymentPolicySchema.nullable().optional(),
  taxPriceMode: taxPriceModeSchema.optional(),
  taxPolicyProfileId: z.string().nullable().optional(),
})

export type UpdateOperatorSettingsInput = z.infer<typeof updateOperatorSettingsSchema>

export async function getOperatorSettings(db: PostgresJsDatabase) {
  const [row] = await db
    .select()
    .from(operatorSettings)
    .orderBy(desc(operatorSettings.createdAt))
    .limit(1)
  return row ?? null
}

export async function upsertOperatorSettings(
  db: PostgresJsDatabase,
  patch: UpdateOperatorSettingsInput,
) {
  const existing = await getOperatorSettings(db)
  if (!existing) {
    const [created] = await db
      .insert(operatorSettings)
      .values({
        ...patch,
        // jsonb expects unknown — cast through here so the union
        // (PaymentPolicy | null | undefined) lands cleanly.
        customerPaymentPolicy: (patch.customerPaymentPolicy ?? null) as unknown,
      } as typeof operatorSettings.$inferInsert)
      .returning()
    return created ?? null
  }
  const [updated] = await db
    .update(operatorSettings)
    .set({
      ...patch,
      customerPaymentPolicy: (patch.customerPaymentPolicy ?? null) as unknown,
      updatedAt: new Date(),
    } as Partial<typeof operatorSettings.$inferInsert>)
    .where(eq(operatorSettings.id, existing.id))
    .returning()
  return updated ?? null
}

/**
 * Strip operator-private fields before exposing the row to the
 * unauthenticated storefront. The customer needs the operator name,
 * postal address, license number, etc. for the contract preview;
 * they should never see VAT id, IBAN, or the customer payment policy
 * (the storefront recomputes the schedule from the public deposit
 * terms it gets back).
 */
export function toPublicOperatorSettings(
  row: typeof operatorSettings.$inferSelect,
): PublicOperatorSettings {
  return {
    name: row.name ?? "",
    legalName: row.legalName ?? "",
    address: row.address ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    website: row.website ?? "",
    license: row.license ?? "",
    licenseAuthority: row.licenseAuthority ?? "",
    customerPaymentPolicy: (row.customerPaymentPolicy as PaymentPolicy | null | undefined) ?? null,
    taxPriceMode: row.taxPriceMode === "exclusive" ? "exclusive" : "inclusive",
    taxPolicyProfileId: row.taxPolicyProfileId ?? null,
  }
}

export interface PublicOperatorSettings {
  name: string
  legalName: string
  address: string
  phone: string
  email: string
  website: string
  license: string
  licenseAuthority: string
  /** Public-safe — the storefront uses it to compute the preview
   *  schedule. Banking / signatory / vatId stay private. */
  customerPaymentPolicy: PaymentPolicy | null
  taxPriceMode: "inclusive" | "exclusive"
  taxPolicyProfileId: string | null
}

async function handleGetOperatorSettings(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const row = await getOperatorSettings(db)
  return c.json({ data: row })
}

async function handlePatchOperatorSettings(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  let patch: UpdateOperatorSettingsInput
  try {
    patch = await parseJsonBody(c, updateOperatorSettingsSchema)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "invalid body" }, 400)
  }
  const row = await upsertOperatorSettings(db, patch)
  return c.json({ data: row })
}

async function handleGetPublicOperatorSettings(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const row = await getOperatorSettings(db)
  if (!row) return c.json({ data: null })
  return c.json({ data: toPublicOperatorSettings(row) })
}

export function mountOperatorSettingsRoutes(hono: Hono): void {
  hono.get("/v1/admin/settings/operator", handleGetOperatorSettings)
  hono.patch("/v1/admin/settings/operator", handlePatchOperatorSettings)
  hono.get("/v1/public/settings/operator", handleGetPublicOperatorSettings)
}
