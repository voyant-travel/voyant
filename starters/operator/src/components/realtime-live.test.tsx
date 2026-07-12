import type { ReactNode } from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useLiveQueries: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock("@voyant-travel/cloud-sdk", () => ({
  RealtimeChannel: class {},
}))

vi.mock("@voyant-travel/realtime-react", () => {
  const hasAdminRealtimeSession = (session: unknown) => {
    if (!session || typeof session !== "object") return false
    const record = session as {
      user?: { id?: unknown } | null
      session?: { userId?: unknown } | null
    }
    return Boolean(record.user?.id || record.session?.userId)
  }

  return {
    AdminRealtimeProvider: ({ children, session }: { children: ReactNode; session: unknown }) => {
      mocks.useLiveQueries(["admin"], () => [], {
        enabled: hasAdminRealtimeSession(session),
      })
      return <>{children}</>
    },
    createRealtimeChannelConnector: vi.fn(() => ({ subscribe: vi.fn() })),
    hasAdminRealtimeSession,
  }
})

vi.mock("@/lib/auth", () => ({
  authClient: {
    useSession: mocks.useSession,
  },
}))

vi.mock("@/lib/env", () => ({
  getApiUrl: () => "/api",
}))

vi.mock("@/lib/voyant-fetcher", () => ({
  projectFetcher: vi.fn(),
}))

import { hasAdminRealtimeSession, RealtimeLiveProvider } from "./realtime-live"

describe("hasAdminRealtimeSession", () => {
  it("rejects anonymous truthy session wrappers", () => {
    expect(hasAdminRealtimeSession({ user: null, session: null })).toBe(false)
    expect(hasAdminRealtimeSession({})).toBe(false)
  })

  it("accepts authenticated session shapes", () => {
    expect(hasAdminRealtimeSession({ user: { id: "usr_1" }, session: null })).toBe(true)
    expect(hasAdminRealtimeSession({ user: null, session: { userId: "usr_1" } })).toBe(true)
  })
})

describe("RealtimeLiveProvider", () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    mocks.useLiveQueries.mockReset()
    mocks.useSession.mockReset()
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it("does not enable admin realtime for anonymous storefront session wrappers", async () => {
    mocks.useSession.mockReturnValue({ data: { user: null, session: null } })

    await act(async () => {
      root.render(
        <RealtimeLiveProvider>
          <div>Storefront</div>
        </RealtimeLiveProvider>,
      )
    })

    expect(mocks.useLiveQueries).toHaveBeenCalledWith(["admin"], expect.any(Function), {
      enabled: false,
    })
  })

  it("enables admin realtime when a signed-in user is present", async () => {
    mocks.useSession.mockReturnValue({ data: { user: { id: "usr_1" }, session: null } })

    await act(async () => {
      root.render(
        <RealtimeLiveProvider>
          <div>Admin</div>
        </RealtimeLiveProvider>,
      )
    })

    expect(mocks.useLiveQueries).toHaveBeenCalledWith(["admin"], expect.any(Function), {
      enabled: true,
    })
  })
})
