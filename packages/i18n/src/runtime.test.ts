import { describe, expect, it } from "vitest"

import { createLocaleFormatters } from "./package-formatters.js"
import {
  formatMessage,
  getLocaleMessageOverridesFromUiPrefs,
  resolveLocaleMessages,
} from "./runtime.js"

type Messages = {
  title: string
  nested: { label: string }
}

const definitions = {
  en: { title: "Title", nested: { label: "Label" } },
  ro: { title: "Titlu", nested: { label: "Etichetă" } },
  "ro-RO": { title: "Titlu România", nested: { label: "Etichetă România" } },
}

describe("locale message resolution", () => {
  it("layers fallback, language, exact region, shared, language, and regional overrides", () => {
    expect(
      resolveLocaleMessages<Messages>({
        locale: "ro_RO",
        fallbackLocale: "en",
        definitions,
        overrides: {
          shared: { nested: { label: "Shared" } },
          locales: {
            ro: { title: "Titlu personalizat" },
            "ro-RO": { nested: { label: "Etichetă regională" } },
          },
        },
      }),
    ).toEqual({ title: "Titlu personalizat", nested: { label: "Etichetă regională" } })
  })

  it("falls back safely for invalid locale tags and rejects empty definitions", () => {
    expect(
      resolveLocaleMessages({ locale: "not a locale", fallbackLocale: "en", definitions }),
    ).toEqual(definitions.en)
    expect(() =>
      resolveLocaleMessages({ locale: "en", fallbackLocale: "en", definitions: {} }),
    ).toThrow(/at least one locale definition/)
  })

  it("sanitizes malformed, unknown, and prototype-related preference overrides", () => {
    const input = JSON.parse(
      '{"i18n":{"admin":{"shared":{"title":"Custom","nested":{"label":4,"extra":"x"},"__proto__":{"polluted":"yes"}}}}}',
    )
    expect(getLocaleMessageOverridesFromUiPrefs<Messages>(input, definitions)).toEqual({
      shared: { title: "Custom" },
    })
    expect(({} as { polluted?: string }).polluted).toBeUndefined()
  })

  it("rejects malformed ICU and argument drift in dynamic overrides", () => {
    const icuDefinitions = {
      en: {
        greeting: "Hello, {name}!",
        nights: "{count, plural, one {# night} other {# nights}}",
      },
    }
    const input = {
      i18n: {
        admin: {
          shared: {
            greeting: "Hello, {other}!",
            nights: "{count, plural, one {# night}",
          },
        },
      },
    }

    expect(getLocaleMessageOverridesFromUiPrefs(input, icuDefinitions)).toBeUndefined()
  })

  it("sanitizes direct provider overrides against the fallback schema", () => {
    expect(
      resolveLocaleMessages<Messages>({
        locale: "en",
        fallbackLocale: "en",
        definitions,
        overrides: {
          shared: {
            title: "Custom",
            nested: { label: 42, extra: "ignored" },
            extra: "ignored",
          } as never,
        },
      }),
    ).toEqual({ title: "Custom", nested: { label: "Label" } })
  })
})

describe("message and value formatting", () => {
  it.each([
    [0, "0 nopți"],
    [1, "1 noapte"],
    [2, "2 nopți"],
    [20, "20 de nopți"],
    [101, "101 nopți"],
  ])("uses Romanian CLDR plural rules for %s", (count, expected) => {
    expect(
      formatMessage(
        "{count, plural, one {# noapte} few {# nopți} other {# de nopți}}",
        { count },
        { locale: "ro" },
      ),
    ).toBe(expected)
  })

  it("throws when a required ICU argument is missing", () => {
    expect(() => formatMessage("Hello, {name}!", {})).toThrow(/name/)
  })

  it("applies and validates the configured timezone", () => {
    const formatter = createLocaleFormatters("en-US", "America/New_York")
    expect(formatter.timeZone).toBe("America/New_York")
    expect(
      formatter.formatDateTime("2026-03-08T07:30:00Z", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    ).toBe("3/8/26, 3:30 AM")
    expect(createLocaleFormatters("en", "Invalid/Zone").timeZone).toBeNull()
  })
})
