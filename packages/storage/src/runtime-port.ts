import { definePort } from "@voyant-travel/core/project"

import type { MediaRoutesOptions } from "./routes.js"
import type { StorageProviderResolver } from "./types.js"

/** Deployment-selected resolver for logical object stores. */
export const storageObjectRuntimePort = definePort<StorageProviderResolver>({
  id: "storage.object",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.resolve !== "function"
    ) {
      throw new Error("storage.object provider must implement resolve().")
    }
  },
})

/** Deployment contract required by the package-owned media runtime factory. */
export const storageMediaRuntimePort = definePort<MediaRoutesOptions>({
  id: "storage.media-runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("storage.media-runtime provider must be an options object.")
    }
    for (const method of ["resolveStorage", "signVideoUploadTicket"] as const) {
      if (typeof provider[method] !== "function") {
        throw new Error(`storage.media-runtime provider must implement ${method}().`)
      }
    }
    if (provider.guessServedMimeType && typeof provider.guessServedMimeType !== "function") {
      throw new Error("storage.media-runtime provider guessServedMimeType must be a function.")
    }
  },
})
