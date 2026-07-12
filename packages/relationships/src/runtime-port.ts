import { definePort } from "@voyant-travel/core/project"

import type { RelationshipsRouteRuntimeOptions } from "./route-runtime.js"

export interface RelationshipsMiceRuntime {
  personExists(db: unknown, personId: string): Promise<boolean>
}

/** Deployment contract consumed by the package-owned Relationships graph runtime. */
export const relationshipsRouteRuntimePort = definePort<RelationshipsRouteRuntimeOptions>({
  id: "relationships.route-runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("relationships.route-runtime provider must be an options object.")
    }
    if (provider.customFields && typeof provider.customFields !== "function") {
      throw new Error("relationships.route-runtime provider customFields must be a function.")
    }
    if (provider.resolveKmsProvider && typeof provider.resolveKmsProvider !== "function") {
      throw new Error("relationships.route-runtime provider resolveKmsProvider must be a function.")
    }
  },
})

/** Narrow Relationships behavior consumed by MICE without deployment wiring. */
export const relationshipsMiceRuntimePort = definePort<RelationshipsMiceRuntime>({
  id: "relationships.mice.runtime",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.personExists !== "function"
    ) {
      throw new Error("relationships.mice.runtime provider must implement personExists().")
    }
  },
})
