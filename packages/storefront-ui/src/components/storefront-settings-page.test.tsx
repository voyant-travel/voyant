import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { StorefrontSettingsPage } from "./storefront-settings-page.js"

const emptySettings = {
  branding: {
    logoUrl: null,
    faviconUrl: null,
    brandMarkUrl: null,
    primaryColor: null,
    accentColor: null,
    supportedLanguages: [],
  },
  support: {
    email: null,
    phone: null,
    links: [],
  },
  legal: {
    termsUrl: null,
    privacyUrl: null,
    cancellationUrl: null,
    defaultContractTemplateId: null,
  },
  localization: {
    defaultLocale: null,
    currencyDisplay: "code",
  },
  forms: {
    billing: { fields: [] },
    travelers: { fields: [] },
  },
  payment: {
    defaultMethod: null,
    methods: [],
    defaultSchedule: null,
    bankTransfer: null,
  },
}

const hookState = vi.hoisted(() => ({
  settingsQuery: {} as Record<string, unknown>,
  mutation: {} as Record<string, unknown>,
}))

vi.mock("@voyantjs/storefront-react", () => ({
  useAdminStorefrontSettings: () => hookState.settingsQuery,
  useAdminStorefrontSettingsMutation: () => hookState.mutation,
}))

describe("StorefrontSettingsPage", () => {
  beforeEach(() => {
    hookState.settingsQuery = {
      data: { data: emptySettings },
      error: null,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    }
    hookState.mutation = {
      error: null,
      isPending: false,
      mutateAsync: vi.fn(),
    }
  })

  it("renders loading placeholders", () => {
    hookState.settingsQuery = { ...hookState.settingsQuery, data: undefined, isLoading: true }

    const markup = renderToStaticMarkup(<StorefrontSettingsPage />)

    expect(markup).toContain("Storefront settings")
    expect(markup).toContain("animate-pulse")
  })

  it("renders load errors with retry affordance", () => {
    hookState.settingsQuery = {
      ...hookState.settingsQuery,
      data: undefined,
      error: new Error("No admin session"),
      isError: true,
    }

    const markup = renderToStaticMarkup(<StorefrontSettingsPage />)

    expect(markup).toContain("Could not load settings")
    expect(markup).toContain("No admin session")
    expect(markup).toContain("Try again")
  })

  it("renders the empty state and save action", () => {
    const markup = renderToStaticMarkup(<StorefrontSettingsPage className="test-page" />)

    expect(markup).toContain("No storefront settings have been saved yet.")
    expect(markup).toContain("Save settings")
    expect(markup).toContain("test-page")
  })
})
