import { describe, expect, it } from "vitest"

import { readSetupPrefill } from "../../src/hono-module.js"

describe("setup provisioning prefill", () => {
  it("accepts opaque JSON values keyed by step id", () => {
    expect(readSetupPrefill({ "operator-settings.profile": { name: "Acme" } })).toEqual({
      "operator-settings.profile": { name: "Acme" },
    })
  })

  it("rejects secret-like values", () => {
    expect(() => readSetupPrefill({ "acme.step": { apiToken: "private" } })).toThrow(/secret-like/)
  })
})
