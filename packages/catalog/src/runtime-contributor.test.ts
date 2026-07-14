import { catalogSearchRuntimePort } from "@voyant-travel/catalog/api-runtime-ports"
import { catalogIndexerProviderPort } from "@voyant-travel/catalog/indexer/provider"
import { describe, expect, it } from "vitest"

import { createCatalogRuntimePortContribution } from "./runtime-contributor.js"

describe("createCatalogRuntimePortContribution", () => {
  it.each([
    undefined,
    null,
    false,
    0,
    "",
    { source: "host" },
  ])("rejects an invalid present catalog.indexer port during boot: %j", async (indexer) => {
    const contribution = createCatalogRuntimePortContribution({
      primitives: {} as never,
      hasRuntimePort: (port) => port.id === catalogIndexerProviderPort.id,
      getRuntimePort: (port) => (port.id === catalogIndexerProviderPort.id ? indexer : {}) as never,
    })
    const search = contribution[catalogSearchRuntimePort.id] as Promise<unknown>
    const observed = Promise.allSettled(
      Object.values(contribution).filter(
        (value): value is Promise<unknown> => value instanceof Promise,
      ),
    )

    await expect(search).rejects.toThrow(
      "catalog.indexer must implement IndexerAdapter or IndexerProvider.create().",
    )
    await observed
  })
})
