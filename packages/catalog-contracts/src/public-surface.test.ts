import { describe, expect, it } from "vitest"

import {
  assertIndexerAdapterConformance,
  type IndexerAdapter,
  type IndexerProvider,
  pickBestCachedLocale,
  type SourceAdapter,
  sourceAdapterSchema,
} from "./index.js"

describe("@voyant-travel/catalog-contracts public surface", () => {
  it("validates source adapter payload surfaces without runtime dependencies", () => {
    const adapter = {
      kind: "test-feed",
      capabilities: {
        verticals: ["cruises"],
        supportsLiveResolution: true,
        supportsDriftDetection: false,
        supportsBookingForwarding: false,
        postBookOperations: [],
      },
      liveResolve: async () => ({ values: {} }),
    } satisfies SourceAdapter

    expect(sourceAdapterSchema.parse(adapter)).toBe(adapter)
  })

  it("exports pure content locale resolution helpers", () => {
    const result = pickBestCachedLocale(
      [
        { locale: "en-GB", payload: "fallback" },
        { locale: "fr-FR", payload: "language" },
      ],
      ["fr-CA", "en-GB"],
    )

    expect(result).toMatchObject({
      served_locale: "fr-FR",
      match_kind: "language_match",
      candidate: { payload: "language" },
    })
  })

  it("exports the indexer provider contract and conformance kit", () => {
    const provider = {
      create({ registries, vectorDimensions }) {
        expect(registries.size).toBe(0)
        expect(vectorDimensions).toBeNull()
        return {} as IndexerAdapter
      },
    } satisfies IndexerProvider

    expect(typeof provider.create).toBe("function")
    expect(typeof assertIndexerAdapterConformance).toBe("function")
  })
})
