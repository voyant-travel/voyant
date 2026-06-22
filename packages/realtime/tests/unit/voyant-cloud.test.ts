import { describe, expect, it, vi } from "vitest"

import { createVoyantCloudRealtimeProvider } from "../../src/providers/voyant-cloud.js"

function fakeClient() {
  const publish = vi.fn().mockResolvedValue({ id: "msg_1" })
  const mint = vi.fn().mockResolvedValue({ token: "tok", expiresAt: "2099-01-01T00:00:00Z" })
  return { client: { realtime: { publish, tokens: { mint } } }, publish, mint }
}

describe("createVoyantCloudRealtimeProvider", () => {
  it("publishes via realtime.publish(channel, { event, data })", async () => {
    const { client, publish } = fakeClient()
    const provider = createVoyantCloudRealtimeProvider({ client })

    await provider.publish("admin", { event: "booking.confirmed", data: { id: "bk_1" } })

    expect(provider.name).toBe("voyant-cloud")
    expect(publish).toHaveBeenCalledWith("admin", {
      event: "booking.confirmed",
      data: { id: "bk_1" },
    })
  })

  it("mints client tokens via realtime.tokens.mint(input)", async () => {
    const { client, mint } = fakeClient()
    const provider = createVoyantCloudRealtimeProvider({ client })

    const input = {
      clientId: "usr_1",
      capabilities: { admin: ["subscribe"] as const },
      ttlSeconds: 60,
    }
    const out = await provider.mintClientToken(input)

    expect(mint).toHaveBeenCalledWith(input)
    expect(out).toEqual({ token: "tok", expiresAt: "2099-01-01T00:00:00Z" })
  })

  it("honours a provider name override", () => {
    const { client } = fakeClient()
    expect(createVoyantCloudRealtimeProvider({ client, name: "cloud-eu" }).name).toBe("cloud-eu")
  })
})
