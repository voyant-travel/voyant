import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { paymentInstruments, vouchers } from "../../src/schema.js"
import { publicFinanceService } from "../../src/service-public.js"
import { VoucherServiceError, vouchersService } from "../../src/service-vouchers.js"
import { migrateVouchersFromPaymentInstruments } from "../../src/service-vouchers-migration.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

async function resetTables(
  // biome-ignore lint/suspicious/noExplicitAny: test db -- owner: finance; existing suppression is intentional pending typed cleanup.
  db: any,
) {
  const tableNames = ["voucher_redemptions", "vouchers", "payment_instruments"]
  const existing = (await db.execute<{ tablename: string }>(sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN (${sql.join(
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      tableNames.map((n) => sql`${n}`),
      sql`, `,
    )})
  `)) as Array<{ tablename: string }>
  if (existing.length === 0) return
  const names = existing.map((r) => `"${r.tablename}"`).join(", ")
  await db.execute(sql.raw(`TRUNCATE ${names} CASCADE`))
}

describe.skipIf(!DB_AVAILABLE)("voucher validFrom + seriesCode", () => {
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

  async function seedVoucher(
    overrides: {
      code?: string
      validFrom?: Date | null
      expiresAt?: Date | null
      seriesCode?: string | null
      status?: "active" | "redeemed" | "expired" | "void"
    } = {},
  ) {
    const [row] = await db
      .insert(vouchers)
      .values({
        code: overrides.code ?? `VF-${Date.now()}`,
        seriesCode: overrides.seriesCode ?? null,
        currency: "EUR",
        initialAmountCents: 10000,
        remainingAmountCents: 10000,
        status: overrides.status ?? "active",
        sourceType: "manual",
        validFrom: overrides.validFrom ?? null,
        expiresAt: overrides.expiresAt ?? null,
      })
      .returning()
    return row!
  }

  describe("service-vouchers redeem guard", () => {
    it("rejects redeem when validFrom is in the future", async () => {
      const voucher = await seedVoucher({
        validFrom: new Date(Date.now() + 60_000),
      })

      let error: VoucherServiceError | null = null
      try {
        await vouchersService.redeem(db, voucher.id, {
          bookingId: "book_fake",
          amountCents: 100,
        })
      } catch (err) {
        if (err instanceof VoucherServiceError) error = err
      }
      expect(error?.code).toBe("voucher_not_started")
    })

    it("allows redeem when validFrom has already passed", async () => {
      const voucher = await seedVoucher({
        validFrom: new Date(Date.now() - 60_000),
      })

      const result = await vouchersService.redeem(db, voucher.id, {
        bookingId: "book_real",
        amountCents: 100,
      })
      expect(result.voucher.remainingAmountCents).toBe(9900)
    })

    it("allows redeem when validFrom is null (no start-of-validity)", async () => {
      const voucher = await seedVoucher({ validFrom: null })

      const result = await vouchersService.redeem(db, voucher.id, {
        bookingId: "book_real",
        amountCents: 100,
      })
      expect(result.voucher.remainingAmountCents).toBe(9900)
    })

    it("prefers inactive over not_started when status is non-active", async () => {
      // Inactive + future validFrom → the inactive check runs first, so the
      // error surfaces as voucher_inactive (rules compose top-to-bottom).
      const voucher = await seedVoucher({
        status: "void",
        validFrom: new Date(Date.now() + 60_000),
      })

      let error: VoucherServiceError | null = null
      try {
        await vouchersService.redeem(db, voucher.id, {
          bookingId: "book_fake",
          amountCents: 100,
        })
      } catch (err) {
        if (err instanceof VoucherServiceError) error = err
      }
      expect(error?.code).toBe("voucher_inactive")
    })
  })

  describe("public validateVoucher not_started branch", () => {
    it("returns reason=not_started when validFrom is in the future", async () => {
      const future = new Date(Date.now() + 60_000)
      await seedVoucher({ code: "NOTYET-1", validFrom: future })

      const result = await publicFinanceService.validateVoucher(db, { code: "NOTYET-1" })
      expect(result.valid).toBe(false)
      expect(result.reason).toBe("not_started")
    })

    it("returns valid when validFrom is in the past", async () => {
      await seedVoucher({ code: "STARTED-1", validFrom: new Date(Date.now() - 60_000) })

      const result = await publicFinanceService.validateVoucher(db, { code: "STARTED-1" })
      expect(result.valid).toBe(true)
    })
  })

  describe("create + update round-trip", () => {
    it("persists seriesCode and validFrom on create", async () => {
      const row = await vouchersService.create(db, {
        currency: "EUR",
        amountCents: 5000,
        sourceType: "promo",
        seriesCode: "GIFT-2026-Q1",
        validFrom: "2026-06-01T00:00:00.000Z",
      })
      expect(row?.seriesCode).toBe("GIFT-2026-Q1")
      expect(row?.validFrom?.toISOString()).toBe("2026-06-01T00:00:00.000Z")
    })

    it("updates seriesCode and validFrom via patch", async () => {
      const voucher = await seedVoucher({ seriesCode: null, validFrom: null })
      const updated = await vouchersService.update(db, voucher.id, {
        seriesCode: "NEWSERIES",
        validFrom: "2026-07-01T00:00:00.000Z",
      })
      expect(updated?.seriesCode).toBe("NEWSERIES")
      expect(updated?.validFrom?.toISOString()).toBe("2026-07-01T00:00:00.000Z")
    })

    it("patches seriesCode to null explicitly", async () => {
      const voucher = await seedVoucher({ seriesCode: "OLD" })
      const updated = await vouchersService.update(db, voucher.id, { seriesCode: null })
      expect(updated?.seriesCode).toBeNull()
    })
  })

  describe("list filter by seriesCode", () => {
    it("returns only vouchers in the requested series", async () => {
      await seedVoucher({ code: "A", seriesCode: "PROMO-1" })
      await seedVoucher({ code: "B", seriesCode: "PROMO-1" })
      await seedVoucher({ code: "C", seriesCode: "PROMO-2" })
      await seedVoucher({ code: "D", seriesCode: null })

      const result = await vouchersService.list(db, {
        seriesCode: "PROMO-1",
        limit: 50,
        offset: 0,
      })
      expect(result.total).toBe(2)
      expect(result.data.map((r) => r.code).sort()).toEqual(["A", "B"])
    })
  })

  describe("migration", () => {
    it("pulls validFrom and effectiveDate from legacy metadata", async () => {
      await db.insert(paymentInstruments).values([
        {
          ownerType: "client",
          instrumentType: "voucher",
          status: "active",
          label: "Has validFrom",
          metadata: {
            code: "LEGACY-VF",
            currency: "EUR",
            amountCents: 2000,
            validFrom: "2026-08-01T00:00:00.000Z",
          },
        },
        {
          ownerType: "client",
          instrumentType: "voucher",
          status: "active",
          label: "Has effectiveDate",
          metadata: {
            code: "LEGACY-ED",
            currency: "EUR",
            amountCents: 2500,
            effectiveDate: "2026-09-01T00:00:00.000Z",
          },
        },
      ])

      const result = await migrateVouchersFromPaymentInstruments(db)
      expect(result.migrated).toBe(2)

      const [rowA] = await db.select().from(vouchers).where(eq(vouchers.code, "LEGACY-VF"))
      const [rowB] = await db.select().from(vouchers).where(eq(vouchers.code, "LEGACY-ED"))
      expect(rowA?.validFrom?.toISOString()).toBe("2026-08-01T00:00:00.000Z")
      expect(rowB?.validFrom?.toISOString()).toBe("2026-09-01T00:00:00.000Z")
    })

    it("pulls seriesCode from legacy metadata", async () => {
      await db.insert(paymentInstruments).values({
        ownerType: "client",
        instrumentType: "voucher",
        status: "active",
        label: "Has series",
        metadata: {
          code: "LEGACY-SC",
          currency: "EUR",
          amountCents: 1000,
          seriesCode: "LEGACY-SERIES",
        },
      })

      await migrateVouchersFromPaymentInstruments(db)
      const [row] = await db.select().from(vouchers).where(eq(vouchers.code, "LEGACY-SC"))
      expect(row?.seriesCode).toBe("LEGACY-SERIES")
    })
  })
})
