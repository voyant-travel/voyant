import type { CustomFieldRegistryResolver, CustomFieldVisibilityChannel } from "./custom-fields.js"
import { definePort } from "./project.js"

/**
 * Database-backed custom-field runtime shared by graph-selected consumers.
 *
 * The package that owns persisted definitions provides this port. Consumers
 * receive both the fresh registry and visibility-filtered entity values without
 * accepting deployment-authored definition input.
 */
export interface CustomFieldsRuntime {
  resolveRegistry: CustomFieldRegistryResolver
  resolveVisibleValues(
    db: unknown,
    entity: string,
    entityId: string,
    channel: CustomFieldVisibilityChannel,
  ): Promise<Record<string, unknown>> | Record<string, unknown>
}

/** Additive owner read capability used by the generic custom-fields runtime. */
export interface CustomFieldValueReaderRuntime {
  resolveVisibleValues(
    db: unknown,
    entity: string,
    entityId: string,
    channel: CustomFieldVisibilityChannel,
  ): Promise<Record<string, unknown> | undefined> | Record<string, unknown> | undefined
}

export const customFieldValueReaderRuntimePort = definePort<CustomFieldValueReaderRuntime>({
  id: "custom-fields.value-reader",
  test(provider) {
    if (
      !provider ||
      typeof provider !== "object" ||
      typeof provider.resolveVisibleValues !== "function"
    ) {
      throw new Error("custom-fields.value-reader provider must implement resolveVisibleValues().")
    }
  },
})

export const customFieldsRuntimePort = definePort<CustomFieldsRuntime>({
  id: "custom-fields.runtime",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.resolveRegistry !== "function" ||
      typeof provider.resolveVisibleValues !== "function"
    ) {
      throw new Error(
        "custom-fields.runtime provider must implement resolveRegistry() and resolveVisibleValues().",
      )
    }
  },
})
