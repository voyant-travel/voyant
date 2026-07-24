import { describe, expect, it, vi } from "vitest"

import { createLocalProvider } from "../../src/providers/local.js"

describe("createLocalProvider", () => {
  it("captures payloads through the provided sink", async () => {
    const sink = vi.fn()
    const provider = createLocalProvider({ sink })

    const result = await provider.send({
      to: "a@example.com",
      channel: "email",
      template: "welcome",
      data: { name: "Mihai" },
    })

    expect(sink).toHaveBeenCalledOnce()
    expect(sink).toHaveBeenCalledWith({
      to: "a@example.com",
      channel: "email",
      template: "welcome",
      data: { name: "Mihai" },
    })
    expect(result.provider).toBe("local")
    expect(result.id).toMatch(/^local_\d+$/)
  })

  it("defaults to email + sms channels", () => {
    const provider = createLocalProvider({ sink: () => {} })
    expect(provider.channels).toEqual(["email", "sms"])
    expect(provider.defaultFromAddress).toBe("local@example.test")
    expect(provider.durableDelivery).toMatchObject({ supported: false })
  })

  it("accepts a custom name and channel list", async () => {
    const sink = vi.fn()
    const provider = createLocalProvider({
      name: "dev-console",
      channels: ["push"],
      sink,
    })
    expect(provider.name).toBe("dev-console")
    expect(provider.channels).toEqual(["push"])
    expect(provider.defaultFromAddress).toBeNull()
    const result = await provider.send({
      to: "device-token",
      channel: "push",
      template: "ping",
    })
    expect(result.id).toMatch(/^dev-console_\d+$/)
    expect(result.provider).toBe("dev-console")
  })

  it("assigns monotonically increasing ids", async () => {
    const provider = createLocalProvider({ sink: () => {} })
    const a = await provider.send({ to: "x", channel: "email", template: "t" })
    const b = await provider.send({ to: "y", channel: "email", template: "t" })
    expect(a.id).toBe("local_1")
    expect(b.id).toBe("local_2")
  })
})
