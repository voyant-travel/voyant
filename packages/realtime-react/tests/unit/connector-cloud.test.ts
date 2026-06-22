import { describe, expect, it, vi } from "vitest"

import {
  type CloudRealtimeMessage,
  type CloudRealtimePresenceEvent,
  createRealtimeChannelConnector,
  type RealtimeChannelCtorOptions,
  type RealtimeChannelLike,
} from "../../src/connector-cloud.js"

/** Fake RealtimeChannel that records construction and lets tests emit frames. */
function makeFakeChannel() {
  const instances: Array<{
    options: RealtimeChannelCtorOptions
    emitMessage: (m: CloudRealtimeMessage) => void
    emitPresence: (p: CloudRealtimePresenceEvent) => void
    enterPresence: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
  }> = []

  class FakeChannel implements RealtimeChannelLike {
    private messageHandlers = new Set<(m: CloudRealtimeMessage) => void>()
    private presenceHandlers = new Set<(p: CloudRealtimePresenceEvent) => void>()
    enterPresence = vi.fn()
    close = vi.fn()

    constructor(public options: RealtimeChannelCtorOptions) {
      instances.push({
        options,
        emitMessage: (m) => {
          for (const h of this.messageHandlers) h(m)
        },
        emitPresence: (p) => {
          for (const h of this.presenceHandlers) h(p)
        },
        enterPresence: this.enterPresence,
        close: this.close,
      })
    }

    on(event: "message", handler: (m: CloudRealtimeMessage) => void): () => void
    on(event: "presence", handler: (p: CloudRealtimePresenceEvent) => void): () => void
    on(event: "message" | "presence", handler: (payload: never) => void): () => void {
      const set = event === "message" ? this.messageHandlers : this.presenceHandlers
      set.add(handler as never)
      return () => set.delete(handler as never)
    }
  }

  return { FakeChannel, instances }
}

describe("createRealtimeChannelConnector", () => {
  it("constructs a channel with the token, sinceId and baseUrl", () => {
    const { FakeChannel, instances } = makeFakeChannel()
    const connector = createRealtimeChannelConnector(FakeChannel, { baseUrl: "https://api.x" })

    connector.subscribe({ channel: "admin", token: "tok", sinceId: "m5" })

    expect(instances[0]?.options).toEqual({
      channel: "admin",
      token: "tok",
      sinceId: "m5",
      baseUrl: "https://api.x",
    })
  })

  it("maps channel messages to { event, data }", () => {
    const { FakeChannel, instances } = makeFakeChannel()
    const connector = createRealtimeChannelConnector(FakeChannel)
    const onMessage = vi.fn()

    connector.subscribe({ channel: "admin", token: "t", onMessage })
    instances[0]?.emitMessage({ event: "booking.confirmed", data: { id: "bk_1" } })

    expect(onMessage).toHaveBeenCalledWith({ event: "booking.confirmed", data: { id: "bk_1" } })
  })

  it("tracks presence membership across enter/update/leave", () => {
    const { FakeChannel, instances } = makeFakeChannel()
    const connector = createRealtimeChannelConnector(FakeChannel)
    const onPresence = vi.fn()

    connector.subscribe({
      channel: "booking:bk_1",
      token: "t",
      onPresence,
      profile: { name: "Ana" },
    })
    const inst = instances[0]
    expect(inst?.enterPresence).toHaveBeenCalledWith({ name: "Ana" })

    inst?.emitPresence({ action: "enter", clientId: "u1", data: { name: "Ana" } })
    inst?.emitPresence({ action: "enter", clientId: "u2", data: { name: "Ben" } })
    expect(onPresence).toHaveBeenLastCalledWith([
      { clientId: "u1", profile: { name: "Ana" } },
      { clientId: "u2", profile: { name: "Ben" } },
    ])

    inst?.emitPresence({ action: "leave", clientId: "u1" })
    expect(onPresence).toHaveBeenLastCalledWith([{ clientId: "u2", profile: { name: "Ben" } }])
  })

  it("closes the channel and detaches handlers on unsubscribe", () => {
    const { FakeChannel, instances } = makeFakeChannel()
    const connector = createRealtimeChannelConnector(FakeChannel)
    const onMessage = vi.fn()

    const sub = connector.subscribe({ channel: "admin", token: "t", onMessage })
    sub.unsubscribe()

    expect(instances[0]?.close).toHaveBeenCalledOnce()
    instances[0]?.emitMessage({ event: "x", data: 1 })
    expect(onMessage).not.toHaveBeenCalled()
  })
})
