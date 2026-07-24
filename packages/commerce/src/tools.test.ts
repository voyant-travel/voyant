import { createToolRegistry } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import {
  archivePromotionTool,
  commerceTools,
  createCancellationPolicyTool,
  resolveSellabilityTool,
} from "./tools.js"

describe("commerce tools", () => {
  it("publishes complete guarded sellability, pricing-policy, and promotion surfaces", () => {
    expect(commerceTools).toHaveLength(14)
    expect(new Set(commerceTools.map((tool) => tool.capabilityId)).size).toBe(14)
    expect(() => createToolRegistry().registerAll(commerceTools)).not.toThrow()
  })

  it("publishes a structural sellability contract", () => {
    expect(
      resolveSellabilityTool.outputSchema.safeParse({ data: [], meta: { total: 0 } }).success,
    ).toBe(true)
    expect(resolveSellabilityTool.outputSchema.safeParse({ data: [] }).success).toBe(false)
  })

  it("keeps writes staff-scoped and reports only concrete reversal support", () => {
    for (const tool of [createCancellationPolicyTool, archivePromotionTool]) {
      expect(tool.audience).toEqual({ source: "grant", allowed: ["staff"] })
      expect(tool.riskPolicy).toMatchObject({
        destructive: false,
        sideEffects: ["data-write"],
      })
    }
    expect(createCancellationPolicyTool.riskPolicy.reversible).toBe(false)
    expect(archivePromotionTool.riskPolicy.reversible).toBe(true)
  })
})
