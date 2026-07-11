import { definePort } from "@voyant-travel/core/project"

import type { MediaRoutesOptions } from "./routes.js"

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
