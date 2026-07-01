import { describe, expect, it } from "vitest"

import { resolveRealtimeProviders } from "./realtime"

describe("resolveRealtimeProviders", () => {
  it("leaves realtime unconfigured without a Voyant API key", () => {
    expect(resolveRealtimeProviders({})).toEqual([])
    expect(resolveRealtimeProviders({ VOYANT_API_KEY: "" })).toEqual([])
  })

  it("does not call Voyant Cloud in local admin auth mode, even with a placeholder key", () => {
    expect(
      resolveRealtimeProviders({
        VOYANT_ADMIN_AUTH_MODE: "local",
        VOYANT_API_KEY: "local-dev",
      }),
    ).toEqual([])
  })

  it("configures Voyant Cloud realtime only in cloud admin auth mode with a key", () => {
    const providers = resolveRealtimeProviders({
      VOYANT_ADMIN_AUTH_MODE: "voyant-cloud",
      VOYANT_API_KEY: "vc_test",
    })

    expect(providers).toHaveLength(1)
    expect(providers[0]?.name).toBe("voyant-cloud")
  })
})
