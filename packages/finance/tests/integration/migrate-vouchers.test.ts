import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { paymentInstruments, vouchers } from "../../src/schema.js"
import { migrateVouchersFromPaymentInstruments } from "../../src/service-vouchers-migration.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

async function resetTables(
  // biome-ignore lint/suspicious/noExplicitAny: test db typing -- owner: finance; existing suppression is intentional pending typed cleanup.
  db: any,
) {
  const tableNames = ["voucher_redemptions", "vouchers", "payment_instruments"]

  const existingTables = (await db.execute<{ tablename: string }>(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (${sql.join(
        // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        tableNames.map((name) => sql`${name}`),
        sql`, `,
      )})
  `)) as Array<{ tablename: string }>

  if (existingTables.length === 0) return

  const names = existingTables.map((row) => `"${row.tablename}"`).join(", ")
  await db.execute(sql.raw(`TRUNCATE ${names} CASCADE`))
}

describe.skipIf(!DB_AVAILABLE)("migrateVouchersFromPaymentInstruments", () => {
  let db: ReturnType<typeof import("@voyant-travel/db/test-utils").createTestDb>

  beforeAll(async () => {
    const { createTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await resetTables(db)
  })

  beforeEach(async () => {
    await resetTables(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  it("migrates legacy voucher with metadata.code and remainingAmountCents", async () => {
    await db.insert(paymentInstruments).values({
      ownerType: "client",
      instrumentType: "voucher",
      status: "active",
      label: "Voucher ABC",
      personId: "pers_demo_client",
      metadata: {
        code: "GIFT-ABC-2025",
        currency: "EUR",
        amountCents: 50000,
        remainingAmountCents: 30000,
        expiresAt: "2026-12-31T23:59:59.000Z",
      },
    })

    const result = await migrateVouchersFromPaymentInstruments(db)

    expect(result.candidates).toBe(1)
    expect(result.migrated).toBe(1)
    expect(result.skipped).toHaveLength(0)

    const [row] = await db.select().from(vouchers).limit(1)
    expect(row).toMatchObject({
      code: "GIFT-ABC-2025",
      currency: "EUR",
      initialAmountCents: 50000,
      remainingAmountCents: 30000,
      status: "active",
      sourceType: "manual",
      issuedToPersonId: "pers_demo_client",
    })
    expect(row?.expiresAt?.toISOString()).toBe("2026-12-31T23:59:59.000Z")
  })

  it("falls back to external_token when metadata.code missing", async () => {
    await db.insert(paymentInstruments).values({
      ownerType: "client",
      instrumentType: "voucher",
      status: "active",
      label: "Legacy voucher",
      externalToken: "LEGACY-123",
      metadata: { currency: "USD", amountCents: 10000 },
    })

    const result = await migrateVouchersFromPaymentInstruments(db)

    expect(result.migrated).toBe(1)
    const [row] = await db.select().from(vouchers).limit(1)
    expect(row?.code).toBe("LEGACY-123")
    // No redemption info → remaining defaults to initial.
    expect(row?.remainingAmountCents).toBe(10000)
  })

  it("falls back to direct_bill_reference when metadata.code and external_token missing", async () => {
    await db.insert(paymentInstruments).values({
      ownerType: "client",
      instrumentType: "voucher",
      status: "active",
      label: "DBR voucher",
      directBillReference: "DBR-001",
      metadata: { currency: "RON", amountCents: 5000 },
    })

    const result = await migrateVouchersFromPaymentInstruments(db)

    expect(result.migrated).toBe(1)
    const [row] = await db.select().from(vouchers).limit(1)
    expect(row?.code).toBe("DBR-001")
  })

  it("is idempotent — re-running skips already-migrated rows", async () => {
    await db.insert(paymentInstruments).values({
      ownerType: "client",
      instrumentType: "voucher",
      status: "active",
      label: "Repeat me",
      metadata: { code: "REPEAT-1", currency: "EUR", amountCents: 1000 },
    })

    const first = await migrateVouchersFromPaymentInstruments(db)
    expect(first.migrated).toBe(1)
    expect(first.skipped).toHaveLength(0)

    const second = await migrateVouchersFromPaymentInstruments(db)
    expect(second.migrated).toBe(0)
    expect(second.skipped).toEqual([expect.objectContaining({ reason: "already_migrated" })])

    const [count] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(vouchers)
      .where(eq(vouchers.code, "REPEAT-1"))
    expect(count?.c).toBe(1)
  })

  it("skips rows missing a code", async () => {
    await db.insert(paymentInstruments).values({
      ownerType: "client",
      instrumentType: "voucher",
      status: "active",
      label: "No code here",
      metadata: { currency: "EUR", amountCents: 2500 },
    })

    const result = await migrateVouchersFromPaymentInstruments(db)
    expect(result.migrated).toBe(0)
    expect(result.skipped[0]).toMatchObject({ reason: "missing_code" })
  })

  it("skips rows missing currency", async () => {
    await db.insert(paymentInstruments).values({
      ownerType: "client",
      instrumentType: "voucher",
      status: "active",
      label: "No currency",
      externalToken: "NOCURR",
      metadata: { amountCents: 2500 },
    })

    const result = await migrateVouchersFromPaymentInstruments(db)
    expect(result.skipped[0]).toMatchObject({ reason: "missing_currency" })
  })

  it("skips rows missing amount", async () => {
    await db.insert(paymentInstruments).values({
      ownerType: "client",
      instrumentType: "voucher",
      status: "active",
      label: "No amount",
      externalToken: "NOAMT",
      metadata: { currency: "EUR" },
    })

    const result = await migrateVouchersFromPaymentInstruments(db)
    expect(result.skipped[0]).toMatchObject({ reason: "missing_amount" })
  })

  it("flips status to redeemed when remainingAmountCents is 0", async () => {
    await db.insert(paymentInstruments).values({
      ownerType: "client",
      instrumentType: "voucher",
      status: "active",
      label: "Spent",
      metadata: {
        code: "SPENT-0",
        currency: "EUR",
        amountCents: 1000,
        remainingAmountCents: 0,
      },
    })

    await migrateVouchersFromPaymentInstruments(db)
    const [row] = await db.select().from(vouchers).limit(1)
    expect(row?.status).toBe("redeemed")
    expect(row?.remainingAmountCents).toBe(0)
  })

  it("flips status to void when source instrument is inactive", async () => {
    await db.insert(paymentInstruments).values({
      ownerType: "client",
      instrumentType: "voucher",
      status: "inactive",
      label: "Archived voucher",
      metadata: {
        code: "VOIDME",
        currency: "EUR",
        amountCents: 10000,
        remainingAmountCents: 10000,
      },
    })

    await migrateVouchersFromPaymentInstruments(db)
    const [row] = await db.select().from(vouchers).limit(1)
    expect(row?.status).toBe("void")
  })

  it("picks up sourceBookingId from metadata.bookingId or bookingIds[0]", async () => {
    await db.insert(paymentInstruments).values([
      {
        ownerType: "client",
        instrumentType: "voucher",
        status: "active",
        label: "Single booking",
        metadata: {
          code: "SRC-1",
          currency: "EUR",
          amountCents: 1000,
          bookingId: "book_legacy_aaa",
        },
      },
      {
        ownerType: "client",
        instrumentType: "voucher",
        status: "active",
        label: "Array bookings",
        metadata: {
          code: "SRC-2",
          currency: "EUR",
          amountCents: 1000,
          bookingIds: ["book_legacy_bbb", "book_legacy_ccc"],
        },
      },
    ])

    await migrateVouchersFromPaymentInstruments(db)

    const [rowA] = await db.select().from(vouchers).where(eq(vouchers.code, "SRC-1"))
    expect(rowA?.sourceBookingId).toBe("book_legacy_aaa")
    const [rowB] = await db.select().from(vouchers).where(eq(vouchers.code, "SRC-2"))
    expect(rowB?.sourceBookingId).toBe("book_legacy_bbb")
  })

  it("dry run reports counts without writing", async () => {
    await db.insert(paymentInstruments).values({
      ownerType: "client",
      instrumentType: "voucher",
      status: "active",
      label: "Dry run candidate",
      metadata: { code: "DRY-1", currency: "EUR", amountCents: 2000 },
    })

    const result = await migrateVouchersFromPaymentInstruments(db, { dryRun: true })
    expect(result.dryRun).toBe(true)
    expect(result.migrated).toBe(1)

    const rows = await db.select().from(vouchers)
    expect(rows).toHaveLength(0)
  })

  it("leaves non-voucher payment_instruments alone", async () => {
    await db.insert(paymentInstruments).values([
      {
        ownerType: "client",
        instrumentType: "credit_card",
        status: "active",
        label: "Amex ending 1234",
        last4: "1234",
      },
      {
        ownerType: "client",
        instrumentType: "voucher",
        status: "active",
        label: "Real voucher",
        metadata: { code: "REAL-1", currency: "EUR", amountCents: 1000 },
      },
    ])

    const result = await migrateVouchersFromPaymentInstruments(db)
    expect(result.candidates).toBe(1)
    expect(result.migrated).toBe(1)
  })
})
