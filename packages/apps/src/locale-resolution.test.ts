import { describe, expect, it } from "vitest"
import {
  createHostLabelResolver,
  type HostLabelRow,
  resolveAppLocale,
  resolveTextDirection,
} from "./locale-resolution.js"

describe("resolveAppLocale", () => {
  const declaration = { defaultLocale: "en", supportedLocales: ["en", "pt", "pt-BR", "ar"] }

  it("prefers an exact match", () => {
    expect(resolveAppLocale("pt-BR", declaration).appLocale).toBe("pt-BR")
  })

  it("falls back to a language match when the exact tag is absent", () => {
    expect(resolveAppLocale("pt-PT", declaration).appLocale).toBe("pt")
  })

  it("is case-insensitive on the requested tag", () => {
    expect(resolveAppLocale("PT-br", declaration).appLocale).toBe("pt-BR")
  })

  it("falls back to the declared default when nothing matches", () => {
    expect(resolveAppLocale("de-DE", declaration).appLocale).toBe("en")
  })

  it("resolves text direction from the resolved locale", () => {
    expect(resolveAppLocale("ar", declaration).direction).toBe("rtl")
    expect(resolveAppLocale("en", declaration).direction).toBe("ltr")
  })
})

describe("resolveTextDirection", () => {
  it("marks RTL languages", () => {
    expect(resolveTextDirection("he-IL")).toBe("rtl")
    expect(resolveTextDirection("fa")).toBe("rtl")
    expect(resolveTextDirection("en-US")).toBe("ltr")
  })
})

describe("createHostLabelResolver", () => {
  const rows: HostLabelRow[] = [
    { locale: "en", surface: "extension", messageKey: "title", text: "Reports" },
    { locale: "en", surface: "navigation", messageKey: "nav", text: "Reports" },
    { locale: "pt", surface: "extension", messageKey: "title", text: "Relatórios" },
  ]

  it("resolves in the app locale first", () => {
    const resolver = createHostLabelResolver(rows, "pt", "en")
    expect(resolver.resolve("title")).toBe("Relatórios")
  })

  it("falls back to the default locale deterministically", () => {
    const resolver = createHostLabelResolver(rows, "pt", "en")
    // "nav" is missing in pt; falls back to en.
    expect(resolver.resolve("nav", ["navigation"])).toBe("Reports")
  })

  it("returns null when no surface carries the key", () => {
    const resolver = createHostLabelResolver(rows, "en", "en")
    expect(resolver.resolve("missing")).toBeNull()
  })
})
