import {
  type CustomFieldsRuntime,
  type CustomFieldValueReaderRuntime,
  customFieldsRuntimePort,
  customFieldValueReaderRuntimePort,
} from "@voyant-travel/core/runtime-port"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { loadCustomFieldRegistry } from "./registry.js"
import { createCustomFieldTargetRegistry } from "./targets.js"

interface CustomFieldsRuntimeContributorHost {
  customFieldTargets?: Parameters<typeof createCustomFieldTargetRegistry>[0]
  getRuntimePorts?<T>(port: { id: string }): readonly T[] | Promise<readonly T[]>
}

/** The generic package, not an entity module, provides database-backed definitions. */
export function createCustomFieldsRuntimePortContribution(
  host: CustomFieldsRuntimeContributorHost = {},
): Readonly<Record<string, unknown>> {
  const targets = createCustomFieldTargetRegistry(host.customFieldTargets ?? [])
  const runtime: CustomFieldsRuntime = {
    resolveRegistry: (db) => loadCustomFieldRegistry(db as PostgresJsDatabase, targets),
    async resolveVisibleValues(db, entity, entityId, channel) {
      const readers = await Promise.resolve(
        host.getRuntimePorts?.<CustomFieldValueReaderRuntime>(customFieldValueReaderRuntimePort) ??
          [],
      )
      for (const reader of readers) {
        const values = await reader.resolveVisibleValues(db, entity, entityId, channel)
        if (values) return values
      }
      return {}
    },
  }
  return { [customFieldsRuntimePort.id]: runtime }
}
