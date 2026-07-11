import { definePort } from "@voyant-travel/core/project"

import type { CruiseContentHonoExtensionOptions } from "./routes-content.js"

export const cruisesContentRuntimePort = definePort<CruiseContentHonoExtensionOptions>({
  id: "cruises.content-runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("cruises.content-runtime provider must be an options object.")
    }
    for (const surface of ["admin", "public"] as const) {
      if (typeof provider[surface]?.resolveRegistry !== "function") {
        throw new Error(
          `cruises.content-runtime provider must configure ${surface}.resolveRegistry().`,
        )
      }
    }
  },
})
