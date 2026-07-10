import { eq, sql } from "drizzle-orm"
import { drizzle, type NodePgClient, type NodePgDatabase } from "drizzle-orm/node-postgres"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { paymentInstruments, vouchers } from "./schema.js"

/**
 * Pulls a (possibly nested, array-wrapped, or null) value out of a JSONB
 * metadata column. Keeps the narrow runtime checks local so callers can stay
 * declarative about the shape they expect.
 */
function asRecord(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }
  return metadata as Record<string, unknown>
}

function asString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function asNumber(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asStringArray(record: Record<string, unknown> | null, key: string): string[] {
  const value = record?.[key]
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
}

function asDate(value: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export interface VoucherMigrationOptions {
  /**
   * When true, report what would happen without writing. Defaults to false.
   */
  dryRun?: boolean
  /**
   * Per-row hook for progress reporting. Not called on skipped rows.
   */
  onRowMigrated?: (info: { paymentInstrumentId: string; voucherCode: string }) => void
}

export interface VoucherMigrationSkip {
  paymentInstrumentId: string
  reason:
    | "already_migrated"
    | "missing_code"
    | "missing_currency"
    | "missing_amount"
    | "duplicate_code_collision"
}

export interface VoucherMigrationResult {
  candidates: number
  migrated: number
  skipped: VoucherMigrationSkip[]
  dryRun: boolean
}

export interface VoucherSetupMigrationContext {
  client: NodePgClient
  dryRun: boolean
}

/** Node migration-runner adapter exported by the package-owned setup facet. */
export async function runVoucherSetupMigration(
  context: VoucherSetupMigrationContext,
): Promise<VoucherMigrationResult> {
  const db = drizzle(context.client)
  return migrateVouchersFromPaymentInstruments(db, { dryRun: context.dryRun })
}

/**
 * Backfill the `vouchers` table from legacy voucher rows in
 * `payment_instruments`. A legacy voucher is a row with `instrumentType =
 * 'voucher'` whose code lives in one of `metadata.code`, `external_token`, or
 * `direct_bill_reference`, and whose balance lives in
 * `metadata.remainingAmountCents` (falling back to `metadata.amountCents` when
 * no redemption has touched the row).
 *
 * The migration is idempotent: rows whose code already exists in the new
 * `vouchers` table are skipped so re-running the script after a partial run
 * (or after issuing new vouchers via the first-class API) is safe.
 *
 * Why skip rather than update: the new table treats `code` as a primary lookup
 * key and the legacy path has already been read-only-fallback since #256
 * landed, so any voucher that exists in both tables is by definition already
 * migrated. Picking one source of truth avoids clobbering balances the
 * operator may have adjusted through the new redemption flow.
 */
export async function migrateVouchersFromPaymentInstruments(
  db: PostgresJsDatabase | NodePgDatabase,
  options: VoucherMigrationOptions = {},
): Promise<VoucherMigrationResult> {
  const dryRun = options.dryRun ?? false
  const skipped: VoucherMigrationSkip[] = []
  let migrated = 0

  const candidates = await db
    .select()
    .from(paymentInstruments)
    .where(eq(paymentInstruments.instrumentType, "voucher"))

  for (const instrument of candidates) {
    const metadata = asRecord(instrument.metadata)

    const code =
      asString(metadata, "code") ?? instrument.externalToken ?? instrument.directBillReference
    if (!code) {
      skipped.push({ paymentInstrumentId: instrument.id, reason: "missing_code" })
      continue
    }

    const currency = asString(metadata, "currency")
    if (!currency || currency.length !== 3) {
      skipped.push({ paymentInstrumentId: instrument.id, reason: "missing_currency" })
      continue
    }

    const initialAmountCents = asNumber(metadata, "amountCents")
    if (initialAmountCents === null || initialAmountCents <= 0) {
      skipped.push({ paymentInstrumentId: instrument.id, reason: "missing_amount" })
      continue
    }
    const remainingAmountCents = asNumber(metadata, "remainingAmountCents") ?? initialAmountCents

    const [existing] = await db
      .select({ id: vouchers.id })
      .from(vouchers)
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(sql`lower(${vouchers.code}) = ${code.toLowerCase()}`)
      .limit(1)
    if (existing) {
      skipped.push({ paymentInstrumentId: instrument.id, reason: "already_migrated" })
      continue
    }

    const expiresAt = asDate(asString(metadata, "expiresAt"))
    // OpenTravel uses `effectiveDate`; some legacy payloads also wrote
    // `validFrom` directly. Check both so existing rows aren't silently
    // dropped.
    const validFrom =
      asDate(asString(metadata, "validFrom")) ?? asDate(asString(metadata, "effectiveDate"))
    const seriesCode = asString(metadata, "seriesCode")
    const bookingIds = asStringArray(metadata, "bookingIds")
    const sourceBookingId = asString(metadata, "bookingId") ?? bookingIds[0] ?? null

    // Collapse the legacy status/balance pair onto the new enum. If there's no
    // balance left, treat as already spent; otherwise follow the instrument's
    // own active/inactive flag.
    const status: "active" | "redeemed" | "void" =
      remainingAmountCents <= 0 ? "redeemed" : instrument.status === "active" ? "active" : "void"

    if (dryRun) {
      migrated++
      options.onRowMigrated?.({ paymentInstrumentId: instrument.id, voucherCode: code })
      continue
    }

    try {
      await db.insert(vouchers).values({
        code,
        seriesCode,
        status,
        currency: currency.toUpperCase(),
        initialAmountCents,
        remainingAmountCents: Math.max(0, remainingAmountCents),
        issuedToPersonId: instrument.personId ?? null,
        issuedToOrganizationId: instrument.organizationId ?? null,
        // We don't know the original source (refund vs gift vs promo) from the
        // legacy shape, so mark everything as `manual` — operators can reclassify
        // later via PATCH /vouchers/:id.
        sourceType: "manual",
        sourceBookingId,
        notes: instrument.notes ?? null,
        validFrom,
        expiresAt,
        createdAt: instrument.createdAt,
        updatedAt: instrument.updatedAt,
      })
      migrated++
      options.onRowMigrated?.({ paymentInstrumentId: instrument.id, voucherCode: code })
    } catch (error) {
      // Unique-index collision is the only realistic insert failure here
      // (another concurrent migration or a race with a manual issuance). Record
      // it as a skip rather than aborting the batch so a retry finishes the
      // rest.
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes("uidx_vouchers_code") || message.includes("duplicate key")) {
        skipped.push({ paymentInstrumentId: instrument.id, reason: "duplicate_code_collision" })
        continue
      }
      throw error
    }
  }

  return {
    candidates: candidates.length,
    migrated,
    skipped,
    dryRun,
  }
}
