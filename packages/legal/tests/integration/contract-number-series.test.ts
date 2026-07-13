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
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
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

  describe("findDefaultActiveByScope", () => {
    it("returns the explicit default when multiple active series share a scope", async () => {
      await contractSeriesService.createSeries(db, {
        name: "Manual Customer",
        prefix: "M",
        separator: "",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        active: true,
      })
      const auto = await contractSeriesService.createSeries(db, {
        name: "Auto Customer",
        prefix: "A",
        separator: "",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        isDefault: true,
        active: true,
      })

      const found = await contractSeriesService.findDefaultActiveByScope(db, "customer")
      expect(found?.id).toBe(auto!.id)
      expect(found?.prefix).toBe("A")
    })

    it("falls back to the sole active series when no default is marked", async () => {
      const created = await contractSeriesService.createSeries(db, {
        name: "Implicit Customer",
        prefix: "I",
        separator: "",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        active: true,
      })

      const found = await contractSeriesService.findDefaultActiveByScope(db, "customer")
      expect(found?.id).toBe(created!.id)
    })

    it("throws when multiple active series share a scope and no default is marked", async () => {
      await contractSeriesService.createSeries(db, {
        name: "Auto Candidate",
        prefix: "A",
        separator: "",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        active: true,
      })
      await contractSeriesService.createSeries(db, {
        name: "Manual Candidate",
        prefix: "M",
        separator: "",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        active: true,
      })

      await expect(
        contractSeriesService.findDefaultActiveByScope(db, "customer"),
      ).rejects.toBeInstanceOf(ContractSeriesAmbiguousError)
    })

    it("keeps only one active default per scope when promoting a series", async () => {
      const first = await contractSeriesService.createSeries(db, {
        name: "First Default",
        prefix: "F",
        separator: "",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        isDefault: true,
        active: true,
      })
      const second = await contractSeriesService.createSeries(db, {
        name: "Second Default",
        prefix: "S",
        separator: "",
        padLength: 4,
        resetStrategy: "never",
        scope: "customer",
        isDefault: true,
        active: true,
      })

      const rows = await contractSeriesService.listSeries(db, { scope: "customer", active: true })
      expect(rows.find((row) => row.id === first!.id)?.isDefault).toBe(false)
      expect(rows.find((row) => row.id === second!.id)?.isDefault).toBe(true)
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
