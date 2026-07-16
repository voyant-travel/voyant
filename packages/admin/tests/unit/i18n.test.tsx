import { describe, expect, it } from "vitest"

import {
  dmcAdminMessageDefinitions,
  formatMessage,
  getLocaleMessageOverridesFromUiPrefs,
  resolveLocaleMessages,
} from "../../src/lib/i18n.js"

type TestMessages = {
  loading: string
  nav: {
    dashboard: string
    settings: string
  }
}

describe("i18n helpers", () => {
  it("resolves locale dictionaries with fallback and deep overrides", () => {
    const result = resolveLocaleMessages<TestMessages>({
      locale: "ro-RO",
      fallbackLocale: "en",
      definitions: {
        en: {
          loading: "Loading...",
          nav: {
            dashboard: "Dashboard",
            settings: "Settings",
          },
        },
        ro: {
          loading: "Se incarca...",
          nav: {
            dashboard: "Panou",
            settings: "Setari",
          },
        },
      },
      overrides: {
        shared: {
          nav: {
            settings: "Preferences",
          },
        },
        locales: {
          ro: {
            loading: "Se personalizeaza...",
          },
        },
      },
    })

    expect(result.loading).toBe("Se personalizeaza...")
    expect(result.nav.dashboard).toBe("Panou")
    expect(result.nav.settings).toBe("Preferences")
  })

  it("reads admin locale overrides from ui prefs", () => {
    const result = getLocaleMessageOverridesFromUiPrefs<TestMessages>({
      i18n: {
        admin: {
          locales: {
            ro: {
              nav: {
                settings: "Preferinte",
              },
            },
          },
        },
      },
    })

    expect(result?.locales?.ro?.nav?.settings).toBe("Preferinte")
  })

  it("layers language and region-specific overrides from least to most specific", () => {
    const result = resolveLocaleMessages<TestMessages>({
      locale: "ro-RO",
      fallbackLocale: "en",
      definitions: {
        en: {
          loading: "Loading...",
          nav: { dashboard: "Dashboard", settings: "Settings" },
        },
        ro: {
          loading: "Se încarcă...",
          nav: { dashboard: "Panou", settings: "Setări" },
        },
      },
      overrides: {
        locales: {
          ro: { nav: { settings: "Preferințe" } },
          "ro-RO": { loading: "Se personalizează..." },
        },
      },
    })

    expect(result.loading).toBe("Se personalizează...")
    expect(result.nav.settings).toBe("Preferințe")
  })

  it("sanitizes untrusted ui preference overrides against message definitions", () => {
    const definitions = {
      en: {
        loading: "Loading...",
        nav: { dashboard: "Dashboard", settings: "Settings" },
      },
    }

    const result = getLocaleMessageOverridesFromUiPrefs<TestMessages>(
      {
        i18n: {
          admin: {
            shared: {
              loading: 42,
              nav: { dashboard: "Home", unknown: "ignored" },
            },
          },
        },
      },
      definitions,
    )

    expect(result).toEqual({ shared: { nav: { dashboard: "Home" } } })
  })

  it("formats ICU plurals using the requested locale and rejects missing values", () => {
    expect(
      formatMessage(
        "{count, plural, one {# noapte} few {# nopți} other {# de nopți}}",
        { count: 20 },
        { locale: "ro" },
      ),
    ).toBe("20 de nopți")

    expect(() => formatMessage("Hello, {name}!", {})).toThrow(/name/)
  })

  it("returns undefined for invalid ui prefs override payloads", () => {
    expect(getLocaleMessageOverridesFromUiPrefs<TestMessages>(null)).toBeUndefined()
    expect(getLocaleMessageOverridesFromUiPrefs<TestMessages>({})).toBeUndefined()
    expect(
      getLocaleMessageOverridesFromUiPrefs<TestMessages>({
        i18n: {
          admin: [],
        },
      }),
    ).toBeUndefined()
  })

  it("includes package-owned DMC app overrides in the composed definitions", () => {
    expect(dmcAdminMessageDefinitions.ro?.availability?.dialogs?.closeout?.reasonPlaceholder).toBe(
      "Vreme, blocaj charter, blackout operational...",
    )
  })
})
