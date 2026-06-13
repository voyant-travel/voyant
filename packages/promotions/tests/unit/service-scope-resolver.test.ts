import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"

import {
  type ResolvePromotionalOfferScopeProductIds,
  resolveScopeProductIds,
} from "../../src/service.js"

describe("resolveScopeProductIds", () => {
  it("deduplicates direct product scopes without calling the Product-backed resolver", async () => {
    const resolver = vi.fn<ResolvePromotionalOfferScopeProductIds>(async () => ["prod_unused"])

    await expect(
      resolveScopeProductIds(
        {} as PostgresJsDatabase,
        { kind: "products", productIds: ["prod_a", "prod_b", "prod_a"] },
        resolver,
      ),
    ).resolves.toEqual(["prod_a", "prod_b"])
    expect(resolver).not.toHaveBeenCalled()
  })

  it("delegates category scope expansion through the Product-backed resolver seam", async () => {
    const db = {} as PostgresJsDatabase
    const resolver = vi.fn<ResolvePromotionalOfferScopeProductIds>(async (receivedDb, scope) => {
      expect(receivedDb).toBe(db)
      expect(scope).toEqual({ kind: "categories", categoryIds: ["cat_a", "cat_b"] })
      return ["prod_a", "prod_c"]
    })

    await expect(
      resolveScopeProductIds(db, { kind: "categories", categoryIds: ["cat_a", "cat_b"] }, resolver),
    ).resolves.toEqual(["prod_a", "prod_c"])
    expect(resolver).toHaveBeenCalledTimes(1)
  })

  it("delegates destination scope expansion through the Product-backed resolver seam", async () => {
    const db = {} as PostgresJsDatabase
    const resolver = vi.fn<ResolvePromotionalOfferScopeProductIds>(async (receivedDb, scope) => {
      expect(receivedDb).toBe(db)
      expect(scope).toEqual({ kind: "destinations", destinationIds: ["dest_a"] })
      return ["prod_b"]
    })

    await expect(
      resolveScopeProductIds(db, { kind: "destinations", destinationIds: ["dest_a"] }, resolver),
    ).resolves.toEqual(["prod_b"])
    expect(resolver).toHaveBeenCalledTimes(1)
  })
})
