import { describe, expect, it } from "vitest"
import {
  buildSeoTranslationInput,
  getOpenGraphImageWarnings,
  resolveEffectiveSeoText,
} from "./product-seo-sharing-section.js"

describe("resolveEffectiveSeoText", () => {
  it("prefers explicit localized SEO copy", () => {
    expect(
      resolveEffectiveSeoText(
        { name: "Base name", description: "Base description" },
        { name: "Localized name", shortDescription: "Short", description: "Long" },
        "SEO title",
        "SEO description",
      ),
    ).toEqual({ title: "SEO title", description: "SEO description" })
  })

  it("uses localized content before base-product fallbacks", () => {
    expect(
      resolveEffectiveSeoText(
        { name: "Base name", description: "Base description" },
        { name: "Localized name", shortDescription: "Short", description: "Long" },
        "",
        "",
      ),
    ).toEqual({ title: "Localized name", description: "Short" })

    expect(
      resolveEffectiveSeoText({ name: "Base name", description: "Base description" }, null, "", ""),
    ).toEqual({ title: "Base name", description: "Base description" })
  })
})

describe("SEO sharing payloads and image guidance", () => {
  it("trims overrides and uses null to clear persisted SEO fields", () => {
    expect(buildSeoTranslationInput("  Search title  ", "  Search description ")).toEqual({
      seoTitle: "Search title",
      seoDescription: "Search description",
    })
    expect(buildSeoTranslationInput("   ", "")).toEqual({
      seoTitle: null,
      seoDescription: null,
    })
  })

  it("reports ratio, undersized-width, and large-file advisories", () => {
    expect(
      getOpenGraphImageWarnings({ width: 800, height: 800, fileSize: 6 * 1024 * 1024 }),
    ).toEqual([
      { code: "ratio" },
      { code: "width", width: 800 },
      { code: "file_size", fileSize: 6 * 1024 * 1024 },
    ])
    expect(getOpenGraphImageWarnings({ width: 1200, height: 630, fileSize: 1024 * 1024 })).toEqual(
      [],
    )
  })
})
