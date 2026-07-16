import type { VoyantGraphCustomFieldTargetDeclaration } from "@voyant-travel/core/project"

type CustomFieldVisibilityInput = {
  isSearchable?: boolean
  isExportable?: boolean
  isInvoiceable?: boolean
}

/**
 * Target manifests are the authority for whether a definition may participate
 * in each reader. Unsupported visibility flags are always persisted as false.
 */
export function normalizeCustomFieldVisibility(
  target: Pick<VoyantGraphCustomFieldTargetDeclaration, "capabilities"> | undefined,
  visibility: CustomFieldVisibilityInput,
): CustomFieldVisibilityInput {
  return {
    isSearchable: target?.capabilities.includes("search") ? visibility.isSearchable : false,
    isExportable: target?.capabilities.includes("export") ? visibility.isExportable : false,
    isInvoiceable: target?.capabilities.includes("invoice") ? visibility.isInvoiceable : false,
  }
}
