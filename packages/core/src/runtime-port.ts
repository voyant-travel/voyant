import type {
  CustomFieldRegistryResolver,
  CustomFieldVisibilityChannel,
  NamespacedCustomFieldValues,
} from "./custom-fields.js"
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
  ): Promise<NamespacedCustomFieldValues> | NamespacedCustomFieldValues
}

/** Additive owner read capability used by the generic custom-fields runtime. */
export interface CustomFieldValueReaderRuntime {
  resolveVisibleValues(
    db: unknown,
    entity: string,
    entityId: string,
    channel: CustomFieldVisibilityChannel,
  ): Promise<NamespacedCustomFieldValues | undefined> | NamespacedCustomFieldValues | undefined
}

export interface CustomFieldValueDefinitionIdentity {
  entityType: string
  namespace: string
  key: string
}

/**
 * Package-owned value lifecycle capability used when a persisted definition
 * changes identity or is removed. Each provider mutates only its own entity
 * tables and receives namespace/key identity from the trusted definition row.
 */
export interface CustomFieldValueLifecycleRuntime {
  supports(entityType: string): boolean
  renameDefinitionKey(
    db: unknown,
    definition: CustomFieldValueDefinitionIdentity,
    nextKey: string,
  ): Promise<void> | void
  deleteDefinitionValues(
    db: unknown,
    definition: CustomFieldValueDefinitionIdentity,
  ): Promise<void> | void
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

export const customFieldValueLifecycleRuntimePort = definePort<CustomFieldValueLifecycleRuntime>({
  id: "custom-fields.value-lifecycle",
  test(provider) {
    if (
      !provider ||
      typeof provider !== "object" ||
      typeof provider.supports !== "function" ||
      typeof provider.renameDefinitionKey !== "function" ||
      typeof provider.deleteDefinitionValues !== "function"
    ) {
      throw new Error(
        "custom-fields.value-lifecycle provider must implement supports(), renameDefinitionKey(), and deleteDefinitionValues().",
      )
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
