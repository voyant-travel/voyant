import { QueryClient } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  capturedProviders: [] as unknown[],
}))

vi.mock("@voyant-travel/admin/providers/operator-admin-shell", async () => {
  const React = await import("react")
  return {
    OperatorAdminShellProvider: ({
      children,
      providers,
    }: {
      children: ReactNode
      providers?: readonly unknown[]
    }) => {
      mocks.capturedProviders = [...(providers ?? [])]
      return React.createElement("div", null, children)
    },
  }
})

vi.mock("@voyant-travel/operations-react/availability/provider", async () => {
  const React = await import("react")
  return {
    VoyantAvailabilityProvider: ({ children }: { children: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  }
})

vi.mock("@voyant-travel/ui/components/tooltip", async () => {
  const React = await import("react")
  function TooltipProvider({ children }: { children: ReactNode }) {
    return React.createElement(React.Fragment, null, children)
  }
  return { TooltipProvider }
})

vi.mock("@/lib/env", () => ({
  getApiUrl: () => "https://operator.test/api",
}))

vi.mock("@/lib/voyant-fetcher", () => ({
  projectFetcher: vi.fn(),
}))

import { Providers } from "./providers"

describe("Providers", () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    mocks.capturedProviders = []
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it("keeps admin realtime out of the root provider stack shared with storefront routes", async () => {
    await act(async () => {
      root.render(
        <Providers queryClient={new QueryClient()}>
          <span>content</span>
        </Providers>,
      )
    })

    expect(host.textContent).toContain("content")
    const providerNames = mocks.capturedProviders.map(
      (provider) => (provider as { name?: string }).name,
    )
    expect(providerNames).toContain("TooltipProvider")
    expect(providerNames).toContain("AvailabilityProvider")
    expect(providerNames).not.toContain("RealtimeLiveProvider")
  })
})
