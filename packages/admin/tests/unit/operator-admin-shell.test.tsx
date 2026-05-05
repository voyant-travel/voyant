import { render, renderHook, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminProvider } from "../../src/providers/admin-provider.js"
import { useLocale } from "../../src/providers/locale.js"
import { AdminLocalePreferenceSync } from "../../src/providers/locale-preferences.js"
import {
  OperatorAdminMessagesProvider,
  useOperatorAdminMessages,
} from "../../src/providers/operator-admin-messages.js"
import {
  type AdminDomainMessagesProviderProps,
  AdminDomainMessagesProviderStack,
} from "../../src/providers/operator-admin-shell.js"

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.remove("light", "dark")
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

describe("operator admin shell helpers", () => {
  it("provides operator admin messages for the active locale", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AdminProvider themeStorageKey={null} defaultLocale="ro">
        <OperatorAdminMessagesProvider>{children}</OperatorAdminMessagesProvider>
      </AdminProvider>
    )

    const { result } = renderHook(() => useOperatorAdminMessages(), { wrapper })

    expect(result.current.nav.dashboard).toBe("Panou")
  })

  it("passes the resolved locale into domain message providers", () => {
    function DomainProvider({ children, locale }: AdminDomainMessagesProviderProps) {
      return (
        <div data-testid="domain-provider" data-locale={locale ?? ""}>
          {children}
        </div>
      )
    }

    render(
      <AdminProvider themeStorageKey={null} defaultLocale="ro">
        <AdminDomainMessagesProviderStack providers={[DomainProvider]}>
          <span>content</span>
        </AdminDomainMessagesProviderStack>
      </AdminProvider>,
    )

    expect(screen.getByTestId("domain-provider").getAttribute("data-locale")).toBe("ro")
  })

  it("syncs user locale preferences when storage has no override", async () => {
    function Probe() {
      const { resolvedLocale, timeZone } = useLocale()
      return <span>{`${resolvedLocale}:${timeZone}`}</span>
    }

    render(
      <AdminProvider themeStorageKey={null} defaultLocale="en" defaultTimeZone="UTC">
        <AdminLocalePreferenceSync source={{ locale: "ro", timezone: "Europe/Bucharest" }} />
        <Probe />
      </AdminProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText("ro:Europe/Bucharest")).not.toBeNull()
    })
  })
})
