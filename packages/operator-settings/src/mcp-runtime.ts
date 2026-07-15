import { defineToolContextContribution } from "@voyant-travel/tools"

import { getOperatorSettings, upsertOperatorSettings } from "./service.js"
import type { OperatorSettingsValue } from "./tools.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["operatorSettings"],
  contribute: ({ context }) => {
    const db = context.db as Parameters<typeof getOperatorSettings>[0]
    return {
      operatorSettings: {
        async getSettings() {
          return serializeSettings(await getOperatorSettings(db))
        },
        async updateSettings(input: Parameters<typeof upsertOperatorSettings>[1]) {
          return serializeSettings(await upsertOperatorSettings(db, input))
        },
      },
    }
  },
})

function serializeSettings(
  settings: Awaited<ReturnType<typeof getOperatorSettings>>,
): OperatorSettingsValue | null {
  if (!settings) return null
  return {
    ...settings,
    ...(settings.createdAt ? { createdAt: settings.createdAt.toISOString() } : {}),
    ...(settings.updatedAt ? { updatedAt: settings.updatedAt.toISOString() } : {}),
  }
}
