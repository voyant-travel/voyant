import { assertPortConforms } from "@voyant-travel/core/project"
import { describe, expect, it } from "vitest"

import { legalRuntimePort } from "../../src/runtime-port.js"

describe("Legal runtime port", () => {
  it("accepts route providers and rejects malformed provider methods", async () => {
    await expect(
      assertPortConforms(legalRuntimePort, {
        resolveDocumentGenerator: () => undefined,
        resolveBookingPiiService: async () => null,
      }),
    ).resolves.toBeUndefined()
    await expect(
      assertPortConforms(legalRuntimePort, {
        resolveDocumentGenerator: "invalid",
      } as never),
    ).rejects.toThrow(/resolveDocumentGenerator must be a function/)
  })
})
