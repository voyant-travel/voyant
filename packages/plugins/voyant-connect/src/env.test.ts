import { describe, expect, it, vi } from "vitest"

import { prepareVoyantConnectSources, resolveVoyantConnectEnv } from "./env.js"

describe("resolveVoyantConnectEnv", () => {
  it("returns null and stays silent when Connect is unconfigured", () => {
    const warn = vi.fn()
    expect(resolveVoyantConnectEnv({}, { warn })).toBeNull()
    expect(warn).not.toHaveBeenCalled()
  })

  it("warns and returns null when config is partial", () => {
    const warn = vi.fn()
    expect(resolveVoyantConnectEnv({ VOYANT_API_KEY: "k" }, { warn })).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("resolves the full config with the documented key fallback order", () => {
    expect(
      resolveVoyantConnectEnv({
        VOYANT_CONNECT_API_KEY: "fallback",
        VOYANT_CONNECT_OPERATOR_ID: "op_1",
        VOYANT_CONNECT_API_URL: "https://connect.example",
        VOYANT_CONNECT_MARKET: "GB",
        VOYANT_CONNECT_SYNC_LIMIT: "100",
        VOYANT_CLOUD_API_URL: "https://api.example/",
      }),
    ).toEqual({
      apiKey: "fallback",
      operatorId: "op_1",
      baseUrl: "https://connect.example",
      market: "GB",
      syncLimit: "100",
      dataBaseUrl: "https://api.example",
    })
  })

  it("prefers VOYANT_API_KEY over the legacy aliases", () => {
    const config = resolveVoyantConnectEnv({
      VOYANT_API_KEY: "primary",
      VOYANT_CONNECT_API_KEY: "legacy",
      VOYANT_CLOUD_API_KEY: "older",
      VOYANT_CONNECT_OPERATOR_ID: "op_1",
    })
    expect(config?.apiKey).toBe("primary")
  })
})

describe("prepareVoyantConnectSources", () => {
  it("returns [] when Connect is unconfigured", async () => {
    await expect(prepareVoyantConnectSources({})).resolves.toEqual([])
  })

  it("returns the un-scoped default adapter pair when enumerate is omitted", async () => {
    const sources = await prepareVoyantConnectSources({
      VOYANT_API_KEY: "k",
      VOYANT_CONNECT_OPERATOR_ID: "op_1",
    })
    expect(sources.map((source) => [source.connectionId, source.role])).toEqual([
      [undefined, "generic"],
      [undefined, "cruises"],
    ])
  })
})
