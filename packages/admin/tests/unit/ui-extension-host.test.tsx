import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import {
  createNavigateMessage,
  createReadyMessage,
  createRequestTokenMessage,
} from "@voyant-travel/admin-extension-sdk"
import type { ReactElement, ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  LocaleProvider,
  OperatorAdminMessagesProvider,
  type UiExtensionContext,
  type UiExtensionDescriptor,
  UiExtensionHost,
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

function descriptor(overrides: Partial<UiExtensionDescriptor> = {}): UiExtensionDescriptor {
  return {
    key: "demo",
    version: "1.0.0",
    displayName: "Demo Extension",
    extensionApi: "^1",
    entryUrl: "https://ext.example.com/demo",
    slots: ["dashboard.header"],
    ...overrides,
  }
}

function getFrame(): HTMLIFrameElement {
  const frame = document.querySelector("iframe")
  if (!frame) throw new Error("expected an iframe to be rendered")
  return frame
}

function deliver(source: unknown, message: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data: message, source: source as Window }))
  })
}

function renderWithAdminMessages(element: ReactElement) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LocaleProvider localeStorageKey={null} timeZoneStorageKey={null}>
      <OperatorAdminMessagesProvider>{children}</OperatorAdminMessagesProvider>
    </LocaleProvider>
  )
  return render(element, { wrapper })
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("UiExtensionHost", () => {
  it("renders a sandboxed frame and completes the handshake on ready", async () => {
    renderWithAdminMessages(
      <UiExtensionHost descriptor={descriptor()} slot="dashboard.header" context={context} />,
    )

    const frame = getFrame()
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-forms allow-popups")
    expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer")
    expect(frame.getAttribute("loading")).toBe("lazy")

    const source = frame.contentWindow as Window
    const post = vi.spyOn(source, "postMessage")
    deliver(source, createReadyMessage())

    await waitFor(() => {
      expect(post).toHaveBeenCalled()
    })
    const initMessage = post.mock.calls[0]?.[0] as { type: string; payload: { apiVersion: string } }
    expect(initMessage.type).toBe("voyant:ext:init")
    expect(initMessage.payload.apiVersion).toBe("1.1.0")
  })

  it("renders a quiet incompatible card and never mounts a frame", () => {
    renderWithAdminMessages(
      <UiExtensionHost
        descriptor={descriptor({ extensionApi: "^2" })}
        slot="dashboard.header"
        context={context}
      />,
    )
    expect(document.querySelector("iframe")).toBeNull()
    expect(screen.getByText(/incompatible with this admin version/i)).toBeTruthy()
  })

  it("degrades to an error card when the handshake times out", async () => {
    vi.useFakeTimers()
    renderWithAdminMessages(
      <UiExtensionHost
        descriptor={descriptor()}
        slot="dashboard.header"
        context={context}
        timeoutMs={10_000}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.getByText(/could not be loaded/i)).toBeTruthy()
    expect(document.querySelector("iframe")).toBeNull()
  })

  it("only navigates on relative admin paths", async () => {
    const onNavigate = vi.fn()
    renderWithAdminMessages(
      <UiExtensionHost
        descriptor={descriptor()}
        slot="dashboard.header"
        context={context}
        onNavigate={onNavigate}
      />,
    )
    const source = getFrame().contentWindow as Window
    deliver(source, createReadyMessage())
    await waitFor(() => expect(screen.queryByText(/loading extension/i)).toBeNull())

    deliver(source, createNavigateMessage("https://evil.example.com"))
    deliver(source, createNavigateMessage("//evil.example.com"))
    expect(onNavigate).not.toHaveBeenCalled()

    deliver(source, createNavigateMessage("/bookings/book_1"))
    expect(onNavigate).toHaveBeenCalledWith("/bookings/book_1")
  })

  it("answers the reserved token request with not-supported", async () => {
    renderWithAdminMessages(
      <UiExtensionHost descriptor={descriptor()} slot="dashboard.header" context={context} />,
    )
    const source = getFrame().contentWindow as Window
    const post = vi.spyOn(source, "postMessage")
    deliver(source, createReadyMessage())
    await waitFor(() => expect(post).toHaveBeenCalled())

    post.mockClear()
    deliver(source, createRequestTokenMessage())
    await waitFor(() => {
      const error = post.mock.calls.find(
        (call) => (call[0] as { type: string }).type === "voyant:ext:error",
      )
      expect(error?.[0]).toMatchObject({ payload: { code: "not-supported" } })
    })
  })

  it("delivers a brokered session token to the requesting frame", async () => {
    const onRequestToken = vi.fn().mockResolvedValue({
      token: "test-session-abc",
      tokenId: "st_1",
      expiresAt: 42,
    })
    renderWithAdminMessages(
      <UiExtensionHost
        descriptor={descriptor()}
        slot="dashboard.header"
        context={context}
        onRequestToken={onRequestToken}
      />,
    )
    const source = getFrame().contentWindow as Window
    const post = vi.spyOn(source, "postMessage")
    deliver(source, createReadyMessage())
    await waitFor(() => expect(post).toHaveBeenCalled())

    post.mockClear()
    deliver(source, createRequestTokenMessage("tok-1"))
    await waitFor(() => {
      const token = post.mock.calls.find(
        (call) => (call[0] as { type: string }).type === "voyant:ext:session-token",
      )
      expect(token?.[0]).toMatchObject({
        payload: { token: "test-session-abc", tokenId: "st_1", requestId: "tok-1" },
      })
    })
    expect(onRequestToken).toHaveBeenCalledTimes(1)
  })

  it("does not post a brokered token once the requesting frame is gone", async () => {
    let releaseToken: (grant: { token: string; tokenId: string; expiresAt: number }) => void =
      () => {}
    const onRequestToken = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        releaseToken = resolve
      }),
    )
    const view = renderWithAdminMessages(
      <UiExtensionHost
        descriptor={descriptor()}
        slot="dashboard.header"
        context={context}
        onRequestToken={onRequestToken}
      />,
    )
    const source = getFrame().contentWindow as Window
    const post = vi.spyOn(source, "postMessage")
    deliver(source, createReadyMessage())
    await waitFor(() => expect(post).toHaveBeenCalled())

    post.mockClear()
    deliver(source, createRequestTokenMessage("tok-nav"))
    await waitFor(() => expect(onRequestToken).toHaveBeenCalledTimes(1))

    // The frame is torn down before the broker settles; the grant must not be
    // posted to the now-detached document.
    view.unmount()
    await act(async () => {
      releaseToken({ token: "leaked", tokenId: "st_leak", expiresAt: 1 })
      await Promise.resolve()
    })
    expect(
      post.mock.calls.some(
        (call) => (call[0] as { type: string }).type === "voyant:ext:session-token",
      ),
    ).toBe(false)
  })

  it("answers unavailable when the broker declines or throws", async () => {
    const onRequestToken = vi.fn().mockResolvedValue(null)
    renderWithAdminMessages(
      <UiExtensionHost
        descriptor={descriptor()}
        slot="dashboard.header"
        context={context}
        onRequestToken={onRequestToken}
      />,
    )
    const source = getFrame().contentWindow as Window
    const post = vi.spyOn(source, "postMessage")
    deliver(source, createReadyMessage())
    await waitFor(() => expect(post).toHaveBeenCalled())

    post.mockClear()
    deliver(source, createRequestTokenMessage("tok-9"))
    await waitFor(() => {
      const error = post.mock.calls.find(
        (call) => (call[0] as { type: string }).type === "voyant:ext:error",
      )
      expect(error?.[0]).toMatchObject({ payload: { code: "unavailable", requestId: "tok-9" } })
    })
  })

  it("ignores messages from a source that is not the frame", async () => {
    const onNavigate = vi.fn()
    renderWithAdminMessages(
      <UiExtensionHost
        descriptor={descriptor()}
        slot="dashboard.header"
        context={context}
        onNavigate={onNavigate}
      />,
    )
    const source = getFrame().contentWindow as Window
    deliver(source, createReadyMessage())
    await waitFor(() => expect(screen.queryByText(/loading extension/i)).toBeNull())

    deliver({}, createNavigateMessage("/bookings"))
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
