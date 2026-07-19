// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type {
  StorefrontApiKeyDto,
  StorefrontDto,
} from "@voyant-travel/auth/storefront-admin-contracts"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it, vi } from "vitest"

import { createSelectedStorefrontAdminExtension } from "./admin.js"
import { StorefrontsPage } from "./components/storefronts-page.js"
import { authQueryKeys } from "./query-keys.js"
import type { StorefrontsAdminApi } from "./storefronts-admin-api.js"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const STOREFRONT: StorefrontDto = {
  id: "storefront_1",
  organizationId: "org_1",
  name: "Web store",
  slug: "web",
  hostingKind: "external",
  siteId: null,
  allowedOrigins: ["https://shop.example"],
  methods: { emailCode: true, emailPassword: false, google: false, facebook: false, apple: false },
  accountPolicy: {
    allowedKinds: ["personal"],
    personalSignup: "open",
    businessOnboarding: "disabled",
  },
  hostOnlyCookies: true,
  createdAt: "2026-07-15T00:00:00.000Z",
  updatedAt: "2026-07-15T00:00:00.000Z",
}

const API_KEY: StorefrontApiKeyDto = {
  id: "key_1",
  storefrontId: "storefront_1",
  kind: "publishable",
  tokenPreview: "vpk_ab12",
  name: null,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: "2026-07-15T00:00:00.000Z",
}

describe("storefront admin surface", () => {
  it("contributes a Storefronts nav section with a reparented Sites sub-view", () => {
    const extension = createSelectedStorefrontAdminExtension()

    const parent = extension.navigation?.[0]?.items[0]
    expect(parent).toMatchObject({ id: "storefronts", url: "/storefronts" })
    expect(parent?.items?.map((item) => item.url)).toEqual(["/storefronts", "/storefronts/sites"])

    expect(extension.routes?.map((route) => route.path)).toEqual([
      "/storefronts",
      "/storefronts/sites",
    ])
    expect(extension.routes?.[0]).toMatchObject({ id: "storefronts", ssr: "data-only" })
    expect(extension.routes?.[0]?.loader).toBeTypeOf("function")
    expect(extension.routes?.[1]?.id).toBe("storefront-sites")
  })

  it("prefetches capabilities and storefronts with credentialed admin calls", async () => {
    const extension = createSelectedStorefrontAdminExtension()
    const fetcher = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith("/capabilities")) {
        return Response.json({ data: { businessAccounts: true, manageProviders: true } })
      }
      return Response.json({ data: [STOREFRONT] })
    })
    const queryClient = new QueryClient()

    await extension.routes?.[0]?.loader?.({
      queryClient,
      runtime: { baseUrl: "/api", fetcher },
      params: {},
    })

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/admin/storefronts/capabilities",
      "/api/v1/admin/storefronts/storefronts",
    ])
    expect(fetcher.mock.calls.every(([, init]) => init?.credentials === "include")).toBe(true)
    expect(queryClient.getQueryData(authQueryKeys.storefrontList())).toEqual([STOREFRONT])
  })

  it("disables business controls when the runtime capability is unavailable", async () => {
    const queryClient = seededQueryClient({ businessAccounts: false, manageProviders: true })
    const container = document.createElement("div")
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StorefrontsPage api={pageApi()} />
        </QueryClientProvider>,
      )
    })
    await clickButton(container, "Web store")

    const businessSwitch = container.querySelector<HTMLButtonElement>(
      "#allow-business-storefront_1",
    )
    expect(businessSwitch?.disabled).toBe(true)
    expect(container.textContent).toContain("Business accounts are not enabled")

    await act(async () => root.unmount())
  })

  it("reveals a freshly issued key exactly once", async () => {
    const queryClient = seededQueryClient({ businessAccounts: true, manageProviders: true })
    const api = pageApi()
    const container = document.createElement("div")
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StorefrontsPage api={api} />
        </QueryClientProvider>,
      )
    })
    await clickButton(container, "Web store")
    await clickButton(container, "Issue publishable key")

    await vi.waitFor(() => expect(api.issueApiKey).toHaveBeenCalledOnce())
    expect(api.issueApiKey).toHaveBeenCalledWith("storefront_1", { kind: "publishable" })
    await vi.waitFor(() => {
      const reveal = container.querySelector<HTMLInputElement>("input[readonly]")
      expect(reveal?.value).toBe("vpk-test-one-time-secret")
    })

    await act(async () => root.unmount())
  })
})

function pageApi(): StorefrontsAdminApi {
  return {
    getCapabilities: vi.fn(async () => ({ businessAccounts: true, manageProviders: true })),
    listStorefronts: vi.fn(async () => [STOREFRONT]),
    getStorefront: vi.fn(async () => STOREFRONT),
    createStorefront: vi.fn(async () => STOREFRONT),
    updateStorefront: vi.fn(async () => STOREFRONT),
    deleteStorefront: vi.fn(async () => undefined),
    setAllowedOrigins: vi.fn(async () => STOREFRONT),
    listApiKeys: vi.fn(async () => [API_KEY]),
    issueApiKey: vi.fn(async () => ({ ...API_KEY, token: "vpk-test-one-time-secret" })),
    rotateApiKey: vi.fn(async () => ({ ...API_KEY, token: "vpk-test-one-time-secret" })),
    revokeApiKey: vi.fn(async () => undefined),
    updateAccountPolicy: vi.fn(async () => STOREFRONT),
    updateMethods: vi.fn(async () => STOREFRONT),
    listProviderCredentials: vi.fn(async () => [
      { provider: "google" as const, configured: false, updatedAt: null },
      { provider: "facebook" as const, configured: false, updatedAt: null },
      { provider: "apple" as const, configured: false, updatedAt: null },
    ]),
    putProviderCredential: vi.fn(async () => undefined),
    deleteProviderCredential: vi.fn(async () => undefined),
  }
}

function seededQueryClient(capabilities: { businessAccounts: boolean; manageProviders: boolean }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(authQueryKeys.storefrontCapabilities(), capabilities)
  queryClient.setQueryData(authQueryKeys.storefrontList(), [STOREFRONT])
  queryClient.setQueryData(authQueryKeys.storefrontApiKeys(STOREFRONT.id), [API_KEY])
  queryClient.setQueryData(authQueryKeys.storefrontProviderCredentials(STOREFRONT.id), [
    { provider: "google", configured: false, updatedAt: null },
    { provider: "facebook", configured: false, updatedAt: null },
    { provider: "apple", configured: false, updatedAt: null },
  ])
  return queryClient
}

async function clickButton(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  )
  if (!button) throw new Error(`Button with text "${text}" not found`)
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
  })
}
