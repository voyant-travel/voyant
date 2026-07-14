import type { SearchResults } from "@voyant-travel/catalog-contracts/indexer/contract"
import { describe, expect, it } from "vitest"
import { type LivePriceFn, type LivePriceResult, rerank } from "./rerank.js"

const hit = (id: string, score: number) => ({
  id,
  score,
  document: { id, fields: {} },
})

const baseResults: SearchResults = {
  hits: [hit("a", 100), hit("b", 90), hit("c", 80)],
  total: 3,
}

describe("rerank", () => {
  it("resorts head by live price ascending", async () => {
    const livePrice: LivePriceFn = async () =>
      new Map<string, LivePriceResult>([
        ["a", { amount: 300, currency: "EUR", source: "live" }],
        ["b", { amount: 100, currency: "EUR", source: "live" }],
        ["c", { amount: 200, currency: "EUR", source: "live" }],
      ])

    const reranked = await rerank(
      baseResults,
      livePrice,
      { market: "default", currency: "EUR" },
      { topN: 3 },
    )
    expect(reranked.hits.map((h) => h.id)).toEqual(["b", "c", "a"])
  })

  it("places stale fallbacks after live results", async () => {
    const livePrice: LivePriceFn = async () =>
      new Map<string, LivePriceResult>([
        ["a", { amount: 200, currency: "EUR", source: "live" }],
        ["b", { amount: 100, currency: "EUR", source: "stale" }],
        ["c", { amount: 50, currency: "EUR", source: "live" }],
      ])

    const reranked = await rerank(
      baseResults,
      livePrice,
      { market: "default", currency: "EUR" },
      { topN: 3 },
    )
    // Live hits sort by price (c=50, a=200), then stale hits (b=100).
    expect(reranked.hits.map((h) => h.id)).toEqual(["c", "a", "b"])
  })

  it("retains hits with no live price unless dropOnLiveMiss is set", async () => {
    const livePrice: LivePriceFn = async () =>
      new Map<string, LivePriceResult>([["a", { amount: 100, currency: "EUR", source: "live" }]])

    const keepDefault = await rerank(
      baseResults,
      livePrice,
      { market: "default", currency: "EUR" },
      { topN: 3 },
    )
    expect(keepDefault.hits.map((h) => h.id)).toContain("b")
    expect(keepDefault.hits.map((h) => h.id)).toContain("c")

    const dropped = await rerank(
      baseResults,
      livePrice,
      { market: "default", currency: "EUR" },
      { topN: 3, dropOnLiveMiss: true },
    )
    expect(dropped.hits.map((h) => h.id)).toEqual(["a"])
  })

  it("returns un-reranked results when the live function throws", async () => {
    const livePrice: LivePriceFn = async () => {
      throw new Error("upstream timeout")
    }
    const reranked = await rerank(baseResults, livePrice, {
      market: "default",
      currency: "EUR",
    })
    expect(reranked.hits.map((h) => h.id)).toEqual(["a", "b", "c"])
  })

  it("preserves the indexer-ranked tail beyond topN", async () => {
    const longResults: SearchResults = {
      hits: [hit("a", 100), hit("b", 90), hit("c", 80), hit("d", 70), hit("e", 60)],
      total: 5,
    }
    const livePrice: LivePriceFn = async (ids) =>
      new Map(ids.map((id) => [id, { amount: 100, currency: "EUR", source: "live" as const }]))
    const reranked = await rerank(
      longResults,
      livePrice,
      { market: "default", currency: "EUR" },
      { topN: 2 },
    )
    // Tail (c, d, e) keeps its original order.
    expect(reranked.hits.slice(2).map((h) => h.id)).toEqual(["c", "d", "e"])
  })
})
