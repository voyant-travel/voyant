import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import type {
  RealtimeClientMessage,
  RealtimeConnector,
  RealtimeSubscribeOptions,
} from "../../src/connector.js"
import { RealtimeReactProvider } from "../../src/provider.js"
import { useLiveQueries } from "../../src/use-live-queries.js"

/** Connector that records subscriptions and lets the test push messages. */
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
    emit(channel: string, message: RealtimeClientMessage) {
      subs.get(channel)?.onMessage?.(message)
    },
    subscribedChannels: () => [...subs.keys()],
  }
}

describe("useLiveQueries", () => {
  it("invalidates mapped query keys when a hint arrives", async () => {
    const fake = createFakeConnector()
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <RealtimeReactProvider
          connector={fake.connector}
          fetchToken={async () => ({ token: "tok", expiresAt: "2099-01-01T00:00:00Z" })}
        >
          {children}
        </RealtimeReactProvider>
      </QueryClientProvider>
    )

    renderHook(
      () =>
        useLiveQueries(["booking:bk_1"], (hint) => [["voyant", hint.entity, "detail", hint.id]]),
      { wrapper },
    )

    await waitFor(() => expect(fake.subscribedChannels()).toContain("booking:bk_1"))

    fake.emit("booking:bk_1", {
      event: "booking.confirmed",
      data: { event: "booking.confirmed", entity: "booking", id: "bk_1" },
    })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["voyant", "booking", "detail", "bk_1"],
    })
  })

  it("subscribes to every channel in a multi-channel set", async () => {
    const fake = createFakeConnector()
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <RealtimeReactProvider
          connector={fake.connector}
          fetchToken={async () => ({ token: "tok", expiresAt: "2099-01-01T00:00:00Z" })}
        >
          {children}
        </RealtimeReactProvider>
      </QueryClientProvider>
    )

    renderHook(
      () => useLiveQueries(["admin", "booking:bk_1"], (hint) => [["voyant", hint.entity, hint.id]]),
      { wrapper },
    )

    // Each channel is subscribed individually — not a single joined string.
    await waitFor(() => expect(fake.subscribedChannels().sort()).toEqual(["admin", "booking:bk_1"]))

    fake.emit("booking:bk_1", {
      event: "booking.confirmed",
      data: { event: "booking.confirmed", entity: "booking", id: "bk_1" },
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["voyant", "booking", "bk_1"] })
  })

  it("does not subscribe when disabled", () => {
    const fake = createFakeConnector()
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <RealtimeReactProvider
          connector={fake.connector}
          fetchToken={async () => ({ token: "tok", expiresAt: "2099-01-01T00:00:00Z" })}
        >
          {children}
        </RealtimeReactProvider>
      </QueryClientProvider>
    )

    renderHook(() => useLiveQueries(["admin"], () => [], { enabled: false }), { wrapper })
    expect(fake.subscribedChannels()).toEqual([])
  })

  it("routes token failures to onError without subscribing", async () => {
    const fake = createFakeConnector()
    const queryClient = new QueryClient()
    const onError = vi.fn()
    const tokenError = new Error("Realtime token request failed: 500")
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <RealtimeReactProvider
          connector={fake.connector}
          fetchToken={async () => Promise.reject(tokenError)}
        >
          {children}
        </RealtimeReactProvider>
      </QueryClientProvider>
    )

    renderHook(() => useLiveQueries(["admin"], () => [], { onError }), { wrapper })

    await waitFor(() => expect(onError).toHaveBeenCalledWith(tokenError))
    expect(fake.subscribedChannels()).toEqual([])
  })

  it("unsubscribes earlier channels when a later subscription fails", async () => {
    const unsubscribe = vi.fn()
    const subscribeError = new Error("channel rejected")
    const connector: RealtimeConnector = {
      subscribe(options) {
        if (options.channel === "booking:bk_1") return { unsubscribe }
        throw subscribeError
      },
    }
    const queryClient = new QueryClient()
    const onError = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <RealtimeReactProvider
          connector={connector}
          fetchToken={async () => ({ token: "tok", expiresAt: "2099-01-01T00:00:00Z" })}
        >
          {children}
        </RealtimeReactProvider>
      </QueryClientProvider>
    )

    renderHook(() => useLiveQueries(["booking:bk_1", "admin"], () => [], { onError }), {
      wrapper,
    })

    await waitFor(() => expect(onError).toHaveBeenCalledWith(subscribeError))
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
