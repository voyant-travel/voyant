import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"

import { useAppPageNavEntries } from "../../src/ui-extensions/app-pages.js"
import type {
  AppPageDescriptor,
  UiExtensionsClient,
} from "../../src/ui-extensions/ui-extensions-extension.js"

function page(overrides: Partial<AppPageDescriptor> = {}): AppPageDescriptor {
  return {
    key: "apin_1:settings",
    installationId: "apin_1",
    path: "/settings",
    entryUrl: "https://app.example.com/settings",
    title: "App Settings",
    navLabel: "Settings",
    ...overrides,
  }
}

function clientWith(pages: AppPageDescriptor[]): UiExtensionsClient {
  return { list: async () => [], listPages: async () => pages }
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe("useAppPageNavEntries", () => {
  it("maps the app-declared icon and splits the descriptor key into route parts", async () => {
    const { result } = renderHook(
      () => useAppPageNavEntries(clientWith([page({ icon: "https://app.example.com/i.svg" })])),
      { wrapper },
    )

    await waitFor(() => expect(result.current).toHaveLength(1))
    const entry = result.current[0]
    expect(entry?.installationId).toBe("apin_1")
    expect(entry?.pageKey).toBe("settings")
    expect(entry?.label).toBe("Settings")
    expect(entry?.icon).toBe("https://app.example.com/i.svg")
  })

  it("omits the icon when the page declares none", async () => {
    const { result } = renderHook(() => useAppPageNavEntries(clientWith([page()])), { wrapper })

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current[0]?.icon).toBeUndefined()
  })
})
