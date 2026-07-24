import { describe, expect, it, vi } from "vitest"

import { createVoyantCloudSmsProvider } from "../../src/providers/voyant-cloud-sms.js"

function makeFakeClient(smsResponse: Record<string, unknown>) {
  const sendMessage = vi.fn(async () => smsResponse)
  return {
    sendMessage,
    client: { sms: { sendMessage } } as Parameters<
      typeof createVoyantCloudSmsProvider
    >[0]["client"],
  }
}

describe("createVoyantCloudSmsProvider", () => {
  it("delegates to the cloud client's sms.sendMessage", async () => {
    const { sendMessage, client } = makeFakeClient({ id: "sm_1" })

    const provider = createVoyantCloudSmsProvider({
      client,
      from: "+40000000000",
      renderTemplate: () => ({ text: "123456 is your code." }),
    })
    expect(provider.durableDelivery).toMatchObject({ supported: false })

    const result = await provider.send({
      to: "+40123456789",
      channel: "sms",
      template: "verification",
    })

    expect(sendMessage).toHaveBeenCalledWith({
      to: "+40123456789",
      from: "+40000000000",
      body: "123456 is your code.",
    })
    expect(result).toEqual({ id: "sm_1", provider: "voyant-cloud-sms" })
  })

  it("uses the payload text directly when no renderer is set", async () => {
    const { sendMessage, client } = makeFakeClient({ id: "sm_2" })

    const provider = createVoyantCloudSmsProvider({ client })

    await provider.send({
      to: "+40123",
      channel: "sms",
      template: "x",
      text: "Hello world",
    })

    expect(sendMessage).toHaveBeenCalledWith({
      to: "+40123",
      from: null,
      body: "Hello world",
    })
  })

  it("payload from overrides the default sender", async () => {
    const { sendMessage, client } = makeFakeClient({ id: "sm_3" })

    const provider = createVoyantCloudSmsProvider({ client, from: "+40000000000" })

    await provider.send({
      to: "+40123",
      channel: "sms",
      template: "x",
      text: "Hi",
      from: "+40999999999",
    })

    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ from: "+40999999999" }))
  })

  it("rejects non-sms payloads", async () => {
    const { client } = makeFakeClient({ id: "sm_4" })

    const provider = createVoyantCloudSmsProvider({ client })

    await expect(
      provider.send({
        to: "x@example.com",
        channel: "email",
        template: "x",
      }),
    ).rejects.toThrow(/only supports the "sms" channel/)
  })
})
