import type { VoyantGraphCustomFieldTarget } from "@voyant-travel/core/project"
import type { z } from "zod"
import { customFieldTypeSchema } from "./contracts.js"

type CustomFieldType = z.infer<typeof customFieldTypeSchema>

export type CustomFieldTarget = Omit<VoyantGraphCustomFieldTarget, "fieldTypes"> & {
  fieldTypes: readonly CustomFieldType[]
}

/** Immutable, selected-graph-derived allowlist used by Settings and the API. */
export function createCustomFieldTargetRegistry(
  targets: readonly VoyantGraphCustomFieldTarget[],
): ReadonlyMap<string, CustomFieldTarget> {
  const byId = new Map<string, CustomFieldTarget>()
  for (const target of targets) {
    if (byId.has(target.id)) throw new Error(`duplicate custom-field target "${target.id}"`)
    byId.set(
      target.id,
      Object.freeze({
        ...target,
        fieldTypes: Object.freeze(
          [
            ...new Set(
              target.fieldTypes.map((fieldType) => customFieldTypeSchema.parse(fieldType)),
            ),
          ].sort(),
        ),
        capabilities: Object.freeze([...new Set(target.capabilities)].sort()),
      }),
    )
  }
  return byId
}
