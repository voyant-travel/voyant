// @vitest-environment jsdom

import type { ReactNode } from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  beforeLoad: vi.fn(),
  initialUser: undefined as unknown,
  navigate: vi.fn(),
  refetch: vi.fn(),
  shellProps: undefined as Record<string, unknown> | undefined,
}))

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }))
vi.mock("@voyant-travel/admin", () => ({ defaultOperatorNavIcons: { bookings: "icon" } }))
vi.mock("@voyant-travel/admin/app", () => ({
  buildAdminExtensionDestinations: () => ({ "extension.home": () => "/extension" }),
}))
vi.mock("@voyant-travel/admin/app/workspace", async () => {
  const React = await import("react")
  return {
    AdminWorkspacePendingFallback: () => React.createElement("div", null, "pending"),
    AdminWorkspaceShell: (props: Record<string, unknown> & { children: ReactNode }) => {
      mocks.shellProps = props
      return React.createElement("div", { "data-testid": "workspace-shell" }, props.children)
    },
    createAdminWorkspaceBeforeLoad: () => mocks.beforeLoad,
  }
})
vi.mock("@voyant-travel/admin-react", async () => {
  const React = await import("react")
  return {
    createAdminUserBindings: () => ({
      UserProvider: ({ children, initialUser }: { children: ReactNode; initialUser: unknown }) => {
        mocks.initialUser = initialUser
        return React.createElement(React.Fragment, null, children)
      },
      useUser: () => ({ user: mocks.initialUser, isLoading: false, refetch: mocks.refetch }),
    }),
  }
})

import { createAdminHostWorkspace } from "../src/workspace"

const user = {
  id: "usr_1",
  email: "staff@example.test",
  firstName: "Staff",
  lastName: "User",
}

describe("createAdminHostWorkspace", () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    mocks.beforeLoad.mockReset()
    mocks.initialUser = undefined
    mocks.navigate.mockReset()
    mocks.refetch.mockReset()
    mocks.shellProps = undefined
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it("composes user, realtime, presentation, destinations, and children", async () => {
    const signOut = vi.fn()
    const updateCurrentUserPreferences = vi.fn(async () => ({ ...user, locale: "ro" }))
    const realtimeProps: Array<Record<string, unknown>> = []
    const createExtensions = vi.fn(() => [{ id: "selected" }])
    const fetcher = vi.fn()
    const channel = class RealtimeChannel {}
    const useSession = vi.fn(() => ({ data: { session: true } }))
    const RealtimeProvider = (props: Record<string, unknown> & { children: ReactNode }) => {
      realtimeProps.push(props)
      return <div data-testid="realtime">{props.children}</div>
    }
    const workspace = createAdminHostWorkspace({
      auth: {
        getCurrentUser: vi.fn(async () => user),
        getBootstrapStatus: vi.fn(async () => ({ hasUsers: true })),
        cloudAuthStartHref: () => "/api/auth/admin/cloud/start",
        signOut,
        updateCurrentUserPreferences,
      },
      presentation: { extensions: [{ id: "selected" }], createExtensions },
      api: { getBaseUrl: () => "/api", fetcher },
      realtime: { Provider: RealtimeProvider, channel, useSession },
    })

    await act(async () => {
      root.render(
        <workspace.Workspace initialUser={user}>
          <span data-testid="child">child</span>
        </workspace.Workspace>,
      )
    })

    expect(
      host.querySelector("[data-testid='realtime'] [data-testid='workspace-shell']"),
    ).not.toBeNull()
    expect(host.querySelector("[data-testid='child']")?.textContent).toBe("child")
    expect(mocks.initialUser).toBe(user)
    expect(realtimeProps[0]).toMatchObject({ fetcher, realtimeChannel: channel, useSession })
    expect(mocks.shellProps).toMatchObject({
      user,
      isUserLoading: false,
      icons: { bookings: "icon" },
    })
    expect(mocks.shellProps?.destinations).toMatchObject({ "extension.home": expect.any(Function) })

    const extensions = mocks.shellProps?.extensions as (messages: {
      nav: Record<string, string>
    }) => unknown
    expect(extensions({ nav: { bookings: "Bookings" } })).toEqual([{ id: "selected" }])
    expect(createExtensions).toHaveBeenCalledWith({ bookings: "Bookings" })

    await (mocks.shellProps?.onPreferenceChange as (value: unknown) => Promise<void>)({
      locale: "ro",
    })
    expect(updateCurrentUserPreferences).toHaveBeenCalledWith({ locale: "ro" })
    expect(mocks.refetch).toHaveBeenCalledOnce()

    await (mocks.shellProps?.onSignOut as () => Promise<void>)()
    expect(signOut).toHaveBeenCalledOnce()
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/sign-in" })
    expect(workspace.beforeLoad).toBe(mocks.beforeLoad)
  })
})
