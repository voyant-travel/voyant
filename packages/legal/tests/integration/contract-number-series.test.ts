import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  ContractSeriesAmbiguousError,
  contractSeriesService,
} from "../../src/contracts/service-series.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("contract_number_series uniqueness + lookups", () => {
  let db: PostgresJsDatabase

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyantjs/db/test-utils")
    await closeTestDb()
  })

  describe("partial unique index on (prefix, scope) WHERE active", () => {
    it("rejects a second active row with the same (prefix, scope)", async () => {
      await contractSeriesService.createSeries(db, {
        name: "First",
        prefix: "CTR",
        separator: "-",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        active: true,
      })

      let thrown: unknown
      try {
        await contractSeriesService.createSeries(db, {
          name: "Second",
          prefix: "CTR",
          separator: "-",
          padLength: 4,
          resetStrategy: "never",
          scope: "customer",
          active: true,
        })
      } catch (err) {
        thrown = err
      }
      expect(thrown).toBeDefined()
      // postgres-js wraps the underlying error in a generic "Failed query"
      // wrapper with the original PostgresError (code 23505) on `.cause`.
      const cause = (thrown as { cause?: { code?: string } }).cause
      expect(cause?.code).toBe("23505")
    })

    it("allows a second row when the first is archived (active=false)", async () => {
      const first = await contractSeriesService.createSeries(db, {
        name: "Old",
        prefix: "CTR",
        separator: "-",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        active: true,
      })
      await contractSeriesService.updateSeries(db, first!.id, { active: false })

      const second = await contractSeriesService.createSeries(db, {
        name: "New",
        prefix: "CTR",
        separator: "-",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        active: true,
      })

      expect(second).not.toBeNull()
      expect(second!.id).not.toBe(first!.id)
    })

    it("allows two active rows with the same prefix but different scopes", async () => {
      const a = await contractSeriesService.createSeries(db, {
        name: "Customer A",
        prefix: "CTR",
        separator: "-",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        active: true,
      })
      const b = await contractSeriesService.createSeries(db, {
        name: "Supplier A",
        prefix: "CTR",
        separator: "-",
        padLength: 4,
        resetStrategy: "never",
        scope: "supplier",
        active: true,
      })

      expect(a).not.toBeNull()
      expect(b).not.toBeNull()
    })
  })

  describe("findActiveByPrefixScope", () => {
    it("returns null when no row matches", async () => {
      const result = await contractSeriesService.findActiveByPrefixScope(db, "NONE", "customer")
      expect(result).toBeNull()
    })

    it("returns the row when exactly one matches", async () => {
      const created = await contractSeriesService.createSeries(db, {
        name: "Customer",
        prefix: "CUS",
        separator: "-",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        active: true,
      })

      const found = await contractSeriesService.findActiveByPrefixScope(db, "CUS", "customer")
      expect(found?.id).toBe(created!.id)
    })

    it("ignores archived rows", async () => {
      const created = await contractSeriesService.createSeries(db, {
        name: "Old",
        prefix: "OLD",
        separator: "-",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        active: true,
      })
      await contractSeriesService.updateSeries(db, created!.id, { active: false })

      const found = await contractSeriesService.findActiveByPrefixScope(db, "OLD", "customer")
      expect(found).toBeNull()
    })
  })

  describe("findSeriesByName", () => {
    it("returns the row when exactly one active match exists", async () => {
      const created = await contractSeriesService.createSeries(db, {
        name: "By Name",
        prefix: "BYN",
        separator: "-",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        active: true,
      })

      const found = await contractSeriesService.findSeriesByName(db, "By Name")
      expect(found?.id).toBe(created!.id)
    })

    it("throws when two active rows share a name across different (prefix, scope)", async () => {
      // Two rows with the same name but different (prefix, scope) — the
      // partial unique index doesn't catch this, but the lookup should
      // refuse to silently pick a winner.
      await contractSeriesService.createSeries(db, {
        name: "Duplicate Label",
        prefix: "AAA",
        separator: "-",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        active: true,
      })
      await contractSeriesService.createSeries(db, {
        name: "Duplicate Label",
        prefix: "BBB",
        separator: "-",
        padLength: 4,
        resetStrategy: "never",
        scope: "supplier",
        active: true,
      })

      await expect(
        contractSeriesService.findSeriesByName(db, "Duplicate Label"),
      ).rejects.toBeInstanceOf(ContractSeriesAmbiguousError)
    })
  })

  describe("upsertByPrefixScope", () => {
    it("creates the row on first call and updates it on second", async () => {
      const first = await contractSeriesService.upsertByPrefixScope(db, {
        name: "Initial",
        prefix: "UPS",
        separator: "-",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        active: true,
      })
      expect(first).not.toBeNull()

      const second = await contractSeriesService.upsertByPrefixScope(db, {
        name: "Renamed",
        prefix: "UPS",
        separator: "/",
        padLength: 6,
        resetStrategy: "annual",
        scope: "customer",
        active: true,
      })

      expect(second!.id).toBe(first!.id)
      expect(second!.name).toBe("Renamed")
      expect(second!.separator).toBe("/")
      expect(second!.padLength).toBe(6)
      expect(second!.resetStrategy).toBe("annual")
    })
  })
})
