import { describe, expect, it } from "vitest"

import { resolveNotificationProviders } from "./notifications"

describe("resolveNotificationProviders", () => {
  it("leaves notification delivery unconfigured without a Voyant API key", () => {
    expect(resolveNotificationProviders({})).toEqual([])
    expect(resolveNotificationProviders({ VOYANT_API_KEY: "" })).toEqual([])
    expect(resolveNotificationProviders({ VOYANT_API_KEY: "   " })).toEqual([])
  })

  it("configures Voyant Cloud notification providers when a key is present", () => {
    const providers = resolveNotificationProviders({
      VOYANT_API_KEY: "vc_test",
      EMAIL_FROM: "Voyant <noreply@example.test>",
    })

    expect(providers.map((provider) => provider.name)).toEqual([
      "voyant-cloud-email",
      "voyant-cloud-sms",
    ])
  })
})
