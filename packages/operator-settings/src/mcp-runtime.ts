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
  const { createdAt, updatedAt, ...value } = settings
  return {
    ...value,
    bankTransferBeneficiary: settings.bankTransferBeneficiary ?? null,
    iban: settings.iban ?? null,
    bank: settings.bank ?? null,
    notes: settings.notes ?? null,
    customerPaymentPolicy: settings.customerPaymentPolicy ?? null,
    bookingCheckoutUrlTemplate: settings.bookingCheckoutUrlTemplate ?? null,
    invoicePayUrlTemplate: settings.invoicePayUrlTemplate ?? null,
    ...(createdAt ? { createdAt: createdAt.toISOString() } : {}),
    ...(updatedAt ? { updatedAt: updatedAt.toISOString() } : {}),
  }
}
