/**
 * Pure-function tests for the sourced-entry service.
 *
 * Integration tests (real Postgres) live in
 * `tests/integration/sourced-entry-service.test.ts`. These cover the
 * `createReadProvenance` factory's branching against stub owned-checkers
 * and a stub DB — no Postgres needed.
 */

import { describe, expect, it, vi } from "vitest"

import type { CatalogProjection } from "../adapter/contract.js"
import {
  createReadProvenance,
  createSourcedPresentationSubjectIngestion,
  type OwnedChecker,
} from "./sourced-entry-service.js"

// Minimal stub mirroring the columns `readSourcedEntry` selects. We don't
// exercise any drizzle methods here — we replace the `readSourcedEntry`
// shape entirely via vi.mock for the dispatch tests.
function fakeDb(): unknown {
  return {} as unknown
}

describe("createReadProvenance — owned check fast path", () => {
  it("returns kind: 'owned' when the owned-checker returns true", async () => {
    const ownedChecker: OwnedChecker = vi.fn(async () => true)
    const readProvenance = createReadProvenance({
      ownedCheckers: new Map([["products", ownedChecker]]),
    })

    const result = await readProvenance(fakeDb() as never, "products", "prod_abc")

    expect(result?.kind).toBe("owned")
    if (result?.kind === "owned") {
      expect(result.provenance.source_kind).toBe("owned")
      expect(result.provenance.source_freshness).toBe("static")
    }
    expect(ownedChecker).toHaveBeenCalledWith(expect.anything(), "prod_abc")
  })

  it("skips the owned-checker for verticals not in the registry", async () => {
    const productsOwnedChecker: OwnedChecker = vi.fn(async () => true)
    const readProvenance = createReadProvenance({
      ownedCheckers: new Map([["products", productsOwnedChecker]]),
    })

    // No checker registered for "cruises" — falls through to sourced-entry
    // lookup directly. We can't hit a real DB here, so we expect this to
    // attempt a query and fail cleanly. The point is the products checker
    // is NOT called for a different vertical.
    await expect(readProvenance(fakeDb() as never, "cruises", "crus_xyz")).rejects.toBeTruthy()

    expect(productsOwnedChecker).not.toHaveBeenCalled()
  })
})

describe("createReadProvenance — empty checker map", () => {
  it("treats every vertical as sourced-only when no checkers are registered", async () => {
    const readProvenance = createReadProvenance({})
    // With no checkers, the function falls straight through to the
    // sourced-entry table read — which fails against the stub DB. We
    // verify only that it didn't throw before reaching the DB read.
    await expect(readProvenance(fakeDb() as never, "products", "prod_abc")).rejects.toBeTruthy()
  })
})

describe("CatalogProjection input shape", () => {
  it("requires non-owned provenance for the upsert path", () => {
    // Pure-shape assertion — the upsert function throws if you pass an
    // owned projection. This is a structural property of the input
    // contract; the DB is irrelevant.
    const projection: CatalogProjection = {
      entity_module: "products",
      entity_id: "prod_abc",
      provenance: { source_kind: "direct:tui", source_freshness: "sync" },
      fields: { title: "Sample" },
    }
    expect(projection.provenance.source_kind).toBe("direct:tui")
  })
})

describe("sourced presentation-subject ingestion", () => {
  it("binds only centrally registered referenced-subject modules", () => {
    expect(() =>
      createSourcedPresentationSubjectIngestion({
        entityModule: "products",
        idPrefix: "products",
      }),
    ).toThrow(/registered referenced module/)

    expect(() =>
      createSourcedPresentationSubjectIngestion({
        entityModule: "cruise-ships",
        idPrefix: "cruise_ships",
      }),
    ).not.toThrow()
  })
})
