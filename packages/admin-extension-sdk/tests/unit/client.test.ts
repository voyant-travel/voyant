import { afterEach, describe, expect, it, vi } from "vitest"

import { initUiExtension } from "../../src/client.js"
import {
  createContextMessage,
  createErrorMessage,
  createInitMessage,
  createTokenMessage,
  type UiExtensionContext,
  type UiExtensionMessage,
} from "../../src/index.js"

const context: UiExtensionContext = {
  org: { slug: "acme", name: "Acme Travel" },
  viewer: { id: "usr_1", displayName: "Ada" },
  entity: null,
  theme: "light",
  locale: "en",
  appLocale: "en",
  direction: "ltr",
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  observed: Element[] = []
  constructor(public callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this)
  }
  observe(element: Element) {
    this.observed.push(element)
  }
  unobserve() {}
  disconnect() {}
}

/** A narrow view for stubbing the observer on a real iframe window. */
type WindowWithResizeObserver = Window & { ResizeObserver?: typeof ResizeObserver }

interface Harness {
  win: Window
  parent: Window
  parentPosts: UiExtensionMessage[]
  deliver: (message: unknown, source?: MessageEventSource | null) => void
  dispose: () => void
}

// A real iframe gives a genuine child window whose `.parent` is the top
// window, so the client can be driven without fabricating a `Window`.
function makeHarness(): Harness {
  const iframe = document.createElement("iframe")
  document.body.appendChild(iframe)
  const win = iframe.contentWindow
  if (!win) throw new Error("iframe has no contentWindow")
  const parent = win.parent
  const parentPosts: UiExtensionMessage[] = []
  const impl = (message: UiExtensionMessage) => {
    parentPosts.push(message)
  }
  vi.spyOn(parent, "postMessage").mockImplementation(impl as typeof parent.postMessage)
  ;(win as WindowWithResizeObserver).ResizeObserver = FakeResizeObserver as typeof ResizeObserver

  const deliver = (message: unknown, source: MessageEventSource | null = parent) => {
    win.dispatchEvent(new MessageEvent("message", { data: message, source }))
  }
  return { win, parent, parentPosts, deliver, dispose: () => iframe.remove() }
}

afterEach(() => {
  FakeResizeObserver.instances = []
  vi.restoreAllMocks()
})

describe("initUiExtension", () => {
  it("posts ready and resolves once the host sends init", async () => {
    const h = makeHarness()
    const promise = initUiExtension({ window: h.win })

    expect(h.parentPosts[0]?.type).toBe("voyant:ext:ready")

    h.deliver(
      createInitMessage({
        apiVersion: "1.0.0",
        slot: "dashboard.header",
        context,
        config: { foo: 1 },
      }),
    )
    const handle = await promise

    expect(handle.slot).toBe("dashboard.header")
    expect(handle.apiVersion).toBe("1.0.0")
    expect(handle.config).toEqual({ foo: 1 })
    expect(handle.context.org.slug).toBe("acme")
    handle.destroy()
    h.dispose()
  })

  it("reports height automatically after init via ResizeObserver", async () => {
    const h = makeHarness()
    const promise = initUiExtension({ window: h.win })
    h.deliver(createInitMessage({ apiVersion: "1.0.0", slot: "s", context, config: {} }))
    const handle = await promise

    expect(FakeResizeObserver.instances).toHaveLength(1)
    expect(h.parentPosts.some((message) => message.type === "voyant:ext:resize")).toBe(true)
    handle.destroy()
    h.dispose()
  })

  it("ignores messages whose source is not the parent window", async () => {
    const h = makeHarness()
    const promise = initUiExtension({ window: h.win, timeoutMs: 30 })
    h.deliver(createInitMessage({ apiVersion: "1.0.0", slot: "s", context, config: {} }), h.win)
    await expect(promise).rejects.toThrow(/Timed out/)
    h.dispose()
  })

  it("delivers context updates to subscribers", async () => {
    const h = makeHarness()
    const promise = initUiExtension({ window: h.win })
    h.deliver(createInitMessage({ apiVersion: "1.0.0", slot: "s", context, config: {} }))
    const handle = await promise

    const seen: UiExtensionContext[] = []
    handle.onContextChange((next) => seen.push(next))
    h.deliver(createContextMessage({ ...context, theme: "dark" }))

    expect(seen).toHaveLength(1)
    expect(seen[0]?.theme).toBe("dark")
    expect(handle.context.theme).toBe("dark")
    handle.destroy()
    h.dispose()
  })

  it("rejects after the handshake timeout elapses", async () => {
    const h = makeHarness()
    await expect(initUiExtension({ window: h.win, timeoutMs: 30 })).rejects.toThrow(/Timed out/)
    h.dispose()
  })

  it("exposes actions that post clamped/capped messages", async () => {
    const h = makeHarness()
    const promise = initUiExtension({ window: h.win })
    h.deliver(createInitMessage({ apiVersion: "1.0.0", slot: "s", context, config: {} }))
    const handle = await promise

    handle.actions.navigate("/bookings/book_1")
    handle.actions.toast("success", "z".repeat(500))
    handle.actions.resize(5000)

    const navigate = h.parentPosts.find((message) => message.type === "voyant:ext:navigate")
    const toast = h.parentPosts.find((message) => message.type === "voyant:ext:toast")
    const resize = h.parentPosts.filter((message) => message.type === "voyant:ext:resize").at(-1)
    expect(navigate).toMatchObject({ payload: { to: "/bookings/book_1" } })
    expect(toast).toMatchObject({ payload: { message: "z".repeat(200) } })
    expect(resize).toMatchObject({ payload: { height: 800 } })
    handle.destroy()
    h.dispose()
  })

  it("resolves requestToken when the host returns a token for the request id", async () => {
    const h = makeHarness()
    const promise = initUiExtension({ window: h.win })
    h.deliver(createInitMessage({ apiVersion: "1.1.0", slot: "s", context, config: {} }))
    const handle = await promise

    const tokenPromise = handle.actions.requestToken()
    const request = h.parentPosts.find((message) => message.type === "voyant:ext:request-token")
    const requestId = (request?.payload as { requestId?: string } | undefined)?.requestId
    expect(requestId).toBeTruthy()

    h.deliver(
      createTokenMessage({
        token: "test-session-abc",
        tokenId: "st_1",
        expiresAt: 1234,
        requestId: requestId as string,
      }),
    )
    await expect(tokenPromise).resolves.toEqual({
      token: "test-session-abc",
      tokenId: "st_1",
      expiresAt: 1234,
    })
    handle.destroy()
    h.dispose()
  })

  it("rejects requestToken when the host declines with an error", async () => {
    const h = makeHarness()
    const promise = initUiExtension({ window: h.win })
    h.deliver(createInitMessage({ apiVersion: "1.1.0", slot: "s", context, config: {} }))
    const handle = await promise

    const tokenPromise = handle.actions.requestToken()
    const request = h.parentPosts.find((message) => message.type === "voyant:ext:request-token")
    const requestId = (request?.payload as { requestId?: string } | undefined)?.requestId
    h.deliver(createErrorMessage("not-supported", requestId))
    await expect(tokenPromise).rejects.toThrow(/not-supported/)
    handle.destroy()
    h.dispose()
  })
})
