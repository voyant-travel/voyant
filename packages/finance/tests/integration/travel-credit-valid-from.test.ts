import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { travelCreditRedemptions, travelCredits } from "../../src/schema.js"
import { publicFinanceService } from "../../src/service-public.js"
import { TravelCreditServiceError, travelCreditsService } from "../../src/service-travel-credits.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

async function resetTables(
  // biome-ignore lint/suspicious/noExplicitAny: test db -- owner: finance; existing suppression is intentional pending typed cleanup.
  db: any,
) {
  const tableNames = ["travel_credit_redemptions", "travel_credits"]
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

describe.skipIf(!DB_AVAILABLE)("travel credit validity and redemption", () => {
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

  async function seedTravelCredit(
    overrides: {
      code?: string
      validFrom?: Date | null
      expiresAt?: Date | null
      seriesCode?: string | null
      status?: "active" | "redeemed" | "expired" | "void"
    } = {},
  ) {
    const [row] = await db
      .insert(travelCredits)
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

  describe("travel credit redemption guards", () => {
    it("rejects redeem when validFrom is in the future", async () => {
      const travelCredit = await seedTravelCredit({
        validFrom: new Date(Date.now() + 60_000),
      })

      let error: TravelCreditServiceError | null = null
      try {
        await travelCreditsService.redeem(db, travelCredit.id, {
          idempotencyKey: "future-credit",
          bookingId: "book_fake",
          amountCents: 100,
        })
      } catch (err) {
        if (err instanceof TravelCreditServiceError) error = err
      }
      expect(error?.code).toBe("travel_credit_not_started")
    })

    it("allows redeem when validFrom has already passed", async () => {
      const travelCredit = await seedTravelCredit({
        validFrom: new Date(Date.now() - 60_000),
      })

      const result = await travelCreditsService.redeem(db, travelCredit.id, {
        idempotencyKey: "past-credit",
        bookingId: "book_real",
        amountCents: 100,
      })
      expect(result.travelCredit.remainingAmountCents).toBe(9900)
    })

    it("allows redeem when validFrom is null (no start-of-validity)", async () => {
      const travelCredit = await seedTravelCredit({ validFrom: null })

      const result = await travelCreditsService.redeem(db, travelCredit.id, {
        idempotencyKey: "unbounded-credit",
        bookingId: "book_real",
        amountCents: 100,
      })
      expect(result.travelCredit.remainingAmountCents).toBe(9900)
    })

    it("prefers inactive over not_started when status is non-active", async () => {
      // Inactive + future validFrom → the inactive check runs first, so the
      // error surfaces as travel_credit_inactive (rules compose top-to-bottom).
      const travelCredit = await seedTravelCredit({
        status: "void",
        validFrom: new Date(Date.now() + 60_000),
      })

      let error: TravelCreditServiceError | null = null
      try {
        await travelCreditsService.redeem(db, travelCredit.id, {
          idempotencyKey: "inactive-credit",
          bookingId: "book_fake",
          amountCents: 100,
        })
      } catch (err) {
        if (err instanceof TravelCreditServiceError) error = err
      }
      expect(error?.code).toBe("travel_credit_inactive")
    })

    it("serializes concurrent redemptions so the balance cannot be overspent", async () => {
      const travelCredit = await seedTravelCredit({ code: "CONCURRENT-SPEND" })

      const outcomes = await Promise.allSettled([
        travelCreditsService.redeem(db, travelCredit.id, {
          idempotencyKey: "concurrent-first",
          bookingId: "book_first",
          amountCents: 7000,
        }),
        travelCreditsService.redeem(db, travelCredit.id, {
          idempotencyKey: "concurrent-second",
          bookingId: "book_second",
          amountCents: 7000,
        }),
      ])

      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1)
      const rejected = outcomes.find((outcome) => outcome.status === "rejected")
      expect(rejected).toMatchObject({
        status: "rejected",
        reason: expect.objectContaining({ code: "travel_credit_insufficient_balance" }),
      })

      const [updated] = await db
        .select()
        .from(travelCredits)
        .where(eq(travelCredits.id, travelCredit.id))
      const redemptions = await db
        .select()
        .from(travelCreditRedemptions)
        .where(eq(travelCreditRedemptions.travelCreditId, travelCredit.id))
      expect(updated?.remainingAmountCents).toBe(3000)
      expect(redemptions).toHaveLength(1)
    })

    it("replays the same redemption without decrementing the balance twice", async () => {
      const travelCredit = await seedTravelCredit({ code: "RETRY-SAFE" })
      const input = {
        idempotencyKey: "redeem-retry-1",
        bookingId: "book_retry",
        amountCents: 2500,
      }

      const first = await travelCreditsService.redeem(db, travelCredit.id, input)
      const replay = await travelCreditsService.redeem(db, travelCredit.id, input)

      expect(replay.redemption?.id).toBe(first.redemption?.id)
      expect(replay.travelCredit.remainingAmountCents).toBe(7500)
      const redemptions = await db
        .select()
        .from(travelCreditRedemptions)
        .where(eq(travelCreditRedemptions.travelCreditId, travelCredit.id))
      expect(redemptions).toHaveLength(1)
    })

    it("rejects reuse of an idempotency key with a different request", async () => {
      const travelCredit = await seedTravelCredit({ code: "RETRY-CONFLICT" })
      await travelCreditsService.redeem(db, travelCredit.id, {
        idempotencyKey: "redeem-conflict-1",
        bookingId: "book_first",
        amountCents: 1000,
      })

      await expect(
        travelCreditsService.redeem(db, travelCredit.id, {
          idempotencyKey: "redeem-conflict-1",
          bookingId: "book_second",
          amountCents: 1000,
        }),
      ).rejects.toMatchObject({ code: "idempotency_conflict" })
    })
  })

  describe("public validateTravelCredit not_started branch", () => {
    it("returns reason=not_started when validFrom is in the future", async () => {
      const future = new Date(Date.now() + 60_000)
      await seedTravelCredit({ code: "NOTYET-1", validFrom: future })

      const result = await publicFinanceService.validateTravelCredit(db, { code: "NOTYET-1" })
      expect(result.valid).toBe(false)
      expect(result.reason).toBe("not_started")
    })

    it("returns valid when validFrom is in the past", async () => {
      await seedTravelCredit({ code: "STARTED-1", validFrom: new Date(Date.now() - 60_000) })

      const result = await publicFinanceService.validateTravelCredit(db, { code: "STARTED-1" })
      expect(result.valid).toBe(true)
    })
  })

  describe("create + update round-trip", () => {
    it("normalizes codes and rejects case-insensitive duplicates", async () => {
      const first = await travelCreditsService.create(db, {
        code: " mixed-case ",
        currency: "EUR",
        amountCents: 5000,
        sourceType: "manual",
      })
      expect(first?.code).toBe("MIXED-CASE")

      await expect(
        travelCreditsService.create(db, {
          code: "mixed-case",
          currency: "EUR",
          amountCents: 5000,
          sourceType: "manual",
        }),
      ).rejects.toMatchObject({ code: "code_in_use" })
    })

    it("persists seriesCode and validFrom on create", async () => {
      const row = await travelCreditsService.create(db, {
        currency: "EUR",
        amountCents: 5000,
        sourceType: "goodwill",
        seriesCode: "GIFT-2026-Q1",
        validFrom: "2026-06-01T00:00:00.000Z",
      })
      expect(row?.seriesCode).toBe("GIFT-2026-Q1")
      expect(row?.validFrom?.toISOString()).toBe("2026-06-01T00:00:00.000Z")
    })

    it("updates seriesCode and validFrom via patch", async () => {
      const travelCredit = await seedTravelCredit({ seriesCode: null, validFrom: null })
      const updated = await travelCreditsService.update(db, travelCredit.id, {
        seriesCode: "NEWSERIES",
        validFrom: "2026-07-01T00:00:00.000Z",
      })
      expect(updated?.seriesCode).toBe("NEWSERIES")
      expect(updated?.validFrom?.toISOString()).toBe("2026-07-01T00:00:00.000Z")
    })

    it("patches seriesCode to null explicitly", async () => {
      const travelCredit = await seedTravelCredit({ seriesCode: "OLD" })
      const updated = await travelCreditsService.update(db, travelCredit.id, { seriesCode: null })
      expect(updated?.seriesCode).toBeNull()
    })
  })

  describe("list filter by seriesCode", () => {
    it("returns only travel credits in the requested series", async () => {
      await seedTravelCredit({ code: "A", seriesCode: "PROMO-1" })
      await seedTravelCredit({ code: "B", seriesCode: "PROMO-1" })
      await seedTravelCredit({ code: "C", seriesCode: "PROMO-2" })
      await seedTravelCredit({ code: "D", seriesCode: null })

      const result = await travelCreditsService.list(db, {
        seriesCode: "PROMO-1",
        limit: 50,
        offset: 0,
      })
      expect(result.total).toBe(2)
      expect(result.data.map((r) => r.code).sort()).toEqual(["A", "B"])
    })
  })
})
