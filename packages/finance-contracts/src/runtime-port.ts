/**
 * Import-cheap deployment declaration for the Finance App API runtime.
 * Runtime DTOs deliberately stay behind `./app-api`.
 */
export const financeAppApiRuntimePort = Object.freeze({
  id: "finance.app-api.runtime",
  test(provider: unknown) {
    if (!provider || typeof provider !== "object") {
      throw new Error("finance.app-api.runtime provider must be an object.")
    }
    for (const method of [
      "getIssuanceDocument",
      "getExternalReference",
      "upsertExternalReference",
      "attachPdfArtifact",
      "updateExternalSyncState",
    ]) {
      if (typeof Reflect.get(provider, method) !== "function") {
        throw new Error(`finance.app-api.runtime provider must implement ${method}().`)
      }
    }
  },
})
