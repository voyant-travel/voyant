import { describe, expect, it } from "vitest"

import { isVoyantCloudAdminAuthMode, resolveVoyantApiKey, tryGetCloudClient } from "./voyant-cloud"

describe("voyant cloud env helpers", () => {
  it("treats missing, empty, and whitespace API keys as unconfigured", () => {
    expect(resolveVoyantApiKey({})).toBeUndefined()
    expect(resolveVoyantApiKey({ VOYANT_API_KEY: "" })).toBeUndefined()
    expect(resolveVoyantApiKey({ VOYANT_API_KEY: "   " })).toBeUndefined()
  })

  it("prefers the canonical key and trims configured values", () => {
    expect(
      resolveVoyantApiKey({
        VOYANT_API_KEY: " vc_primary ",
        VOYANT_CLOUD_API_KEY: "vc_legacy",
      }),
    ).toBe("vc_primary")
    expect(resolveVoyantApiKey({ VOYANT_CLOUD_API_KEY: " vc_legacy " })).toBe("vc_legacy")
  })

  it("recognizes only explicit Voyant Cloud admin auth mode", () => {
    expect(isVoyantCloudAdminAuthMode({})).toBe(false)
    expect(isVoyantCloudAdminAuthMode({ VOYANT_ADMIN_AUTH_MODE: "local" })).toBe(false)
    expect(isVoyantCloudAdminAuthMode({ VOYANT_ADMIN_AUTH_MODE: "voyant-cloud" })).toBe(true)
  })

  it("does not pass whitespace-only legacy API keys through to the Cloud SDK", () => {
    expect(tryGetCloudClient({ VOYANT_CLOUD_API_KEY: "   " })).toBeNull()
  })
})
