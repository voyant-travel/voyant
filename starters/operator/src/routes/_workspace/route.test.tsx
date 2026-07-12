import type { ReactNode } from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  user: {
    id: "usr_1",
    email: "staff@example.test",
    firstName: "Staff",
    lastName: "User",
    locale: "en",
    timezone: null,
    uiPrefs: null,
    isSuperAdmin: true,
    isSupportUser: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    profilePictureUrl: null,
  },
  signOut: vi.fn(),
}))

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react")
  return {
    createFileRoute: () => (config: Record<string, unknown>) => ({
      ...config,
      useLoaderData: () => ({ user: mocks.user }),
    }),
    Outlet: () => React.createElement("div", { "data-testid": "workspace-outlet" }),
  }
})

vi.mock("@voyant-travel/admin", () => ({
  defaultOperatorNavIcons: {},
}))

vi.mock("@voyant-travel/admin/app/workspace", async () => {
  const React = await import("react")
  return {
    AdminWorkspacePendingFallback: () =>
      React.createElement("div", { "data-testid": "workspace-pending" }),
    AdminWorkspaceShell: ({ children }: { children: ReactNode }) =>
      React.createElement("div", { "data-testid": "workspace-shell" }, children),
    createAdminWorkspaceBeforeLoad: () => vi.fn(),
  }
})

vi.mock("@/components/providers/user-provider", async () => {
  const React = await import("react")
  return {
    UserProvider: ({ children }: { children: ReactNode }) =>
      React.createElement("div", { "data-testid": "user-provider" }, children),
    useUser: () => ({ user: mocks.user, isLoading: false }),
  }
})

vi.mock("@voyant-travel/realtime-react", async () => {
  const React = await import("react")
  return {
    AdminWorkspaceRealtimeProvider: ({ children }: { children: ReactNode }) =>
      React.createElement("div", { "data-testid": "realtime-live" }, children),
  }
})

vi.mock("@/lib/admin-destinations", () => ({
  operatorAdminDestinations: {},
}))

vi.mock("@/lib/admin-extensions", () => ({
  createOperatorAdminExtensions: () => [],
}))

vi.mock("@/lib/auth", () => ({
  authClient: { useSession: vi.fn() },
  useSignOut: () => mocks.signOut,
}))

vi.mock("@voyant-travel/cloud-sdk", () => ({
  RealtimeChannel: class {},
}))

vi.mock("@/lib/env", () => ({
  getApiUrl: () => "/api",
}))

vi.mock("@/lib/voyant-fetcher", () => ({
  projectFetcher: vi.fn(),
}))

vi.mock("@/lib/admin-auth-runtime", () => ({
  adminAuthRuntime: {
    getCurrentUser: vi.fn(),
    getBootstrapStatus: vi.fn(async () => ({ hasUsers: true })),
    cloudAuthStartHref: () => "/api/auth/cloud/start",
    signOut: vi.fn(),
  },
}))

import { WorkspaceLayout } from "./route"

describe("_workspace route", () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it("mounts admin realtime only inside the authenticated workspace layout", async () => {
    await act(async () => {
      root.render(<WorkspaceLayout />)
    })

    expect(host.querySelector("[data-testid='user-provider']")).not.toBeNull()
    expect(
      host.querySelector("[data-testid='realtime-live'] [data-testid='workspace-shell']"),
    ).not.toBeNull()
    expect(host.querySelector("[data-testid='workspace-outlet']")).not.toBeNull()
  })
})
