import { describe, expect, it, vi } from "vitest"

import type { OperatorSettingsToolContext } from "./tools.js"
import { getOperatorSettingsTool, updateOperatorSettingsTool } from "./tools.js"

const settings = {
  name: "Voyant Travel",
  bankTransferBeneficiary: null,
  iban: null,
  bank: null,
  notes: null,
  customerPaymentPolicy: null,
  bookingCheckoutUrlTemplate: null,
  invoicePayUrlTemplate: null,
}

function context(
  overrides: Partial<NonNullable<OperatorSettingsToolContext["operatorSettings"]>> = {},
): OperatorSettingsToolContext {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "tenant-1",
    resolverScope: {
      locale: "en",
      audience: "staff",
      market: "default",
      actor: "staff",
    },
    operatorSettings: {
      getSettings: vi.fn(async () => settings),
      updateSettings: vi.fn(async () => settings),
      ...overrides,
    },
  }
}

describe("operator settings tools", () => {
  it("reads the combined settings aggregate", async () => {
    const ctx = context()

    await expect(getOperatorSettingsTool.handler({}, ctx)).resolves.toEqual({ settings })
    expect(ctx.operatorSettings?.getSettings).toHaveBeenCalledOnce()
  })

  it("updates settings through the injected service", async () => {
    const updateSettings = vi.fn(async () => settings)
    const ctx = context({ updateSettings })

    await expect(
      updateOperatorSettingsTool.handler({ name: "Voyant Travel" }, ctx),
    ).resolves.toEqual({ settings })
    expect(updateSettings).toHaveBeenCalledWith({ name: "Voyant Travel" })
  })

  it("publishes typed schemas and guarded write risk", () => {
    expect(getOperatorSettingsTool.outputSchema.safeParse({ settings }).success).toBe(true)
    expect(
      updateOperatorSettingsTool.inputSchema.safeParse({ email: "not-an-email" }).success,
    ).toBe(false)
    expect(updateOperatorSettingsTool.requiredScopes).toEqual(["settings:write"])
    expect(updateOperatorSettingsTool.riskPolicy).toMatchObject({
      confirmationRequired: true,
      reversible: true,
      sideEffects: ["data-write"],
    })
  })
})
