import { describe, expect, it } from "vitest"

import { readSetupPrefill, readSetupSteps } from "../../src/api-runtime.js"

describe("setup provisioning prefill", () => {
  it("accepts opaque JSON values keyed by step id", () => {
    expect(readSetupPrefill({ "operator-settings.profile": { name: "Acme" } })).toEqual({
      "operator-settings.profile": { name: "Acme" },
    })
  })

  it("rejects secret-like values", () => {
    expect(() => readSetupPrefill({ "acme.step": { apiToken: "private" } })).toThrow(/secret-like/)
  })

  it("reads selected graph step policy and rejects duplicate ids", () => {
    expect(readSetupSteps([{ id: "acme.required", skippable: false }])).toEqual([
      { id: "acme.required", skippable: false },
    ])
    expect(() =>
      readSetupSteps([
        { id: "duplicate", skippable: true },
        { id: "duplicate", skippable: false },
      ]),
    ).toThrow(/duplicate/)
  })
})
