import { describe, expect, it } from "vitest"

import { assertStorageProviderConformance } from "./conformance.js"
import { createLocalStorageProvider } from "./providers/local.js"

describe("assertStorageProviderConformance", () => {
  it("accepts a conforming provider", async () => {
    await expect(
      assertStorageProviderConformance({ createProvider: createLocalStorageProvider }),
    ).resolves.toBeUndefined()
  })
})
