import { assertPortConforms } from "@voyant-travel/core/project"
import { describe, expect, it } from "vitest"

import { smartbillRuntimeHostPort } from "../../src/runtime-port.js"

describe("SmartBill graph runtime host port", () => {
  it("accepts the injected Node host contract", async () => {
    await expect(
      assertPortConforms(smartbillRuntimeHostPort, {
        resolveConfig: () => null,
        resolveDatabase: () => ({}) as never,
        resolveDocumentStorage: () => null,
      }),
    ).resolves.toBeUndefined()
  })

  it("rejects incomplete or malformed host adapters", async () => {
    await expect(
      assertPortConforms(smartbillRuntimeHostPort, {
        resolveConfig: () => null,
      } as never),
    ).rejects.toThrow("resolveDatabase")
    await expect(
      assertPortConforms(smartbillRuntimeHostPort, {
        resolveConfig: () => null,
        resolveDatabase: () => ({}) as never,
        resolveDocumentStorage: true,
      } as never),
    ).rejects.toThrow("resolveDocumentStorage")
  })
})
