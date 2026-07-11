import { definePort } from "@voyant-travel/core/project"

import type { AccommodationContentHonoExtensionOptions } from "./routes-content.js"

export const accommodationsContentRuntimePort =
  definePort<AccommodationContentHonoExtensionOptions>({
    id: "accommodations.content-runtime",
    test(provider) {
      if (provider === null || typeof provider !== "object") {
        throw new Error("accommodations.content-runtime provider must be an options object.")
      }
      for (const surface of ["admin", "public"] as const) {
        if (typeof provider[surface]?.resolveRegistry !== "function") {
          throw new Error(
            `accommodations.content-runtime provider must configure ${surface}.resolveRegistry().`,
          )
        }
      }
    },
  })
