import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import type { RealtimeConnector, RealtimeSubscribeOptions } from "../../src/connector.js"
import { RealtimeReactProvider } from "../../src/provider.js"
import { useChannel } from "../../src/use-channel.js"

function createFakeConnector() {
  const subs = new Map<string, RealtimeSubscribeOptions>()
  const connector: RealtimeConnector = {
    subscribe(options) {
      subs.set(options.channel, options)
      return {
        unsubscribe() {
          subs.delete(options.channel)
        },
      }
    },
  }
  return {
    connector,
    subscribedChannels: () => [...subs.keys()],
  }
}

describe("useChannel", () => {
  it("does not subscribe when realtime is disabled for the deployment", async () => {
    const fake = createFakeConnector()
    const onError = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RealtimeReactProvider connector={fake.connector} fetchToken={async () => null}>
        {children}
      </RealtimeReactProvider>
    )

    renderHook(() => useChannel("admin", { onError }), { wrapper })

    await waitFor(() => expect(fake.subscribedChannels()).toEqual([]))
    expect(onError).not.toHaveBeenCalled()
  })

  it("routes token failures to onError without subscribing", async () => {
    const fake = createFakeConnector()
    const onError = vi.fn()
    const tokenError = new Error("Realtime token request failed: 401")
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RealtimeReactProvider
        connector={fake.connector}
        fetchToken={async () => Promise.reject(tokenError)}
      >
        {children}
      </RealtimeReactProvider>
    )

    renderHook(() => useChannel("admin", { onError }), { wrapper })

    await waitFor(() => expect(onError).toHaveBeenCalledWith(tokenError))
    expect(fake.subscribedChannels()).toEqual([])
  })
})
