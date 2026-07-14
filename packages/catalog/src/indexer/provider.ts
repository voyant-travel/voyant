import type { IndexerProvider } from "@voyant-travel/catalog-contracts/indexer/contract"
import { definePort } from "@voyant-travel/core/project"

export const catalogIndexerProviderPort = definePort<IndexerProvider>({
  id: "catalog.indexer",
  test(provider) {
    if (!provider || typeof provider !== "object" || typeof provider.create !== "function") {
      throw new Error("catalog.indexer provider must implement create().")
    }
  },
})
