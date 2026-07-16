import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"

import {
  createLocaleFormatters,
  createPackageMessagesContext,
  resolvePackageMessages,
} from "../../src/lib/i18n.js"

type PackageMessages = {
  heading: string
  labels: {
    confirm: string
  }
}

const {
  MessagesProvider: AlphaProvider,
  ResolvedMessagesProvider: AlphaResolvedProvider,
  useI18n: useAlphaI18n,
  useMessages: useAlphaMessages,
  useOptionalI18n: useOptionalAlphaI18n,
} = createPackageMessagesContext<PackageMessages>("AlphaMessages")

const { MessagesProvider: BetaProvider, useMessages: useBetaMessages } =
  createPackageMessagesContext<PackageMessages>("BetaMessages")

describe("package i18n helpers", () => {
  it("creates isolated contexts for each package seam", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AlphaProvider
        locale="en-US"
        messages={{
          heading: "Alpha heading",
          labels: { confirm: "Alpha confirm" },
        }}
      >
        <BetaProvider
          locale="ro-RO"
          messages={{
            heading: "Beta heading",
            labels: { confirm: "Beta confirm" },
          }}
        >
          {children}
        </BetaProvider>
      </AlphaProvider>
    )

    const { result: alpha } = renderHook(() => useAlphaMessages(), { wrapper })
    const { result: beta } = renderHook(() => useBetaMessages(), { wrapper })

    expect(alpha.current.heading).toBe("Alpha heading")
    expect(beta.current.heading).toBe("Beta heading")
  })

  it("exposes locale-aware formatters from the package hook", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AlphaProvider
        locale="ro-RO"
        messages={{
          heading: "Titlu",
          labels: { confirm: "Confirma" },
        }}
      >
        {children}
      </AlphaProvider>
    )

    const { result } = renderHook(() => useAlphaI18n(), { wrapper })

    expect(result.current.locale).toBe("ro-RO")
    expect(result.current.formatNumber(1234.5, { maximumFractionDigits: 1 })).toBe(
      new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(1234.5),
    )
    expect(result.current.formatDate("2026-04-28T12:00:00Z", { timeZone: "UTC" })).toBe(
      new Intl.DateTimeFormat("ro-RO", { timeZone: "UTC" }).format(
        new Date("2026-04-28T12:00:00Z"),
      ),
    )
  })

  it("resolves package locale definitions with fallback and overrides", () => {
    const result = resolvePackageMessages<PackageMessages>({
      locale: "ro-RO",
      fallbackLocale: "en",
      definitions: {
        en: {
          heading: "Heading",
          labels: { confirm: "Confirm" },
        },
        ro: {
          heading: "Titlu",
          labels: { confirm: "Confirma" },
        },
      },
      overrides: {
        shared: {
          labels: { confirm: "Proceed" },
        },
        locales: {
          ro: {
            heading: "Titlu personalizat",
          },
        },
      },
    })

    expect(result.heading).toBe("Titlu personalizat")
    expect(result.labels.confirm).toBe("Proceed")
  })

  it("provides a resolved provider wrapper for package seams", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AlphaResolvedProvider
        locale="ro-RO"
        fallbackLocale="en"
        definitions={{
          en: {
            heading: "Heading",
            labels: { confirm: "Confirm" },
          },
          ro: {
            heading: "Titlu",
            labels: { confirm: "Confirma" },
          },
        }}
      >
        {children}
      </AlphaResolvedProvider>
    )

    const { result } = renderHook(() => useAlphaMessages(), { wrapper })
    expect(result.current.heading).toBe("Titlu")
  })

  it("throws when a package hook is used outside its provider", () => {
    expect(() => renderHook(() => useAlphaMessages())).toThrow(/AlphaMessages context is missing/)
  })

  it("returns undefined from the optional package hook outside a provider", () => {
    const { result } = renderHook(() => useOptionalAlphaI18n())
    expect(result.current).toBeUndefined()
  })

  it("creates explicit locale formatters without a React provider", () => {
    const formatters = createLocaleFormatters("en-US", "America/New_York")

    expect(formatters.formatCurrency(1234, "USD")).toBe(
      new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(1234),
    )
    expect(formatters.timeZone).toBe("America/New_York")
    expect(
      formatters.formatDateTime("2026-04-28T01:00:00Z", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    ).toBe(
      new Intl.DateTimeFormat("en-US", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/New_York",
      }).format(new Date("2026-04-28T01:00:00Z")),
    )
    expect(
      formatters.formatMessage("{count, plural, one {# item} other {# items}}", { count: 2 }),
    ).toBe("2 items")
  })
})
