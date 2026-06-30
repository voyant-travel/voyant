import { describe, expect, it } from "vitest"

import {
  resolveProductDetailBaseLanguageToggleTag,
  resolveProductDetailDescription,
  resolveProductDetailSelectedLanguageTag,
} from "./product-detail-language.js"

const frenchTranslation = {
  languageTag: "fr",
  description: "Description FR",
}

describe("product detail language selection", () => {
  it("starts on base content when only a non-default translation exists", () => {
    const selectedLanguageTag = resolveProductDetailSelectedLanguageTag({
      defaultLanguageTag: "en",
      selectedLanguageTag: "",
      translations: [frenchTranslation],
    })

    expect(selectedLanguageTag).toBe("en")
    expect(
      resolveProductDetailBaseLanguageToggleTag({
        defaultLanguageTag: "en",
        translations: [frenchTranslation],
      }),
    ).toBe("en")
    expect(
      resolveProductDetailDescription({
        defaultLanguageTag: "en",
        productDescription: "Description EN",
        selectedLanguageTag,
        translations: [frenchTranslation],
      }),
    ).toBe("Description EN")
  })

  it("selects the default-language row before other translations when one exists", () => {
    const selectedLanguageTag = resolveProductDetailSelectedLanguageTag({
      defaultLanguageTag: "en",
      selectedLanguageTag: "",
      translations: [
        frenchTranslation,
        {
          languageTag: "en",
          description: "Stale translated EN",
        },
      ],
    })

    expect(selectedLanguageTag).toBe("en")
    expect(
      resolveProductDetailDescription({
        defaultLanguageTag: "en",
        productDescription: "Description EN",
        selectedLanguageTag,
        translations: [
          frenchTranslation,
          {
            languageTag: "en",
            description: "Stale translated EN",
          },
        ],
      }),
    ).toBe("Description EN")
  })

  it("keeps an explicitly selected non-default translation", () => {
    const selectedLanguageTag = resolveProductDetailSelectedLanguageTag({
      defaultLanguageTag: "en",
      selectedLanguageTag: "fr",
      translations: [frenchTranslation],
    })

    expect(selectedLanguageTag).toBe("fr")
    expect(
      resolveProductDetailDescription({
        defaultLanguageTag: "en",
        productDescription: "Description EN",
        selectedLanguageTag,
        translations: [frenchTranslation],
      }),
    ).toBe("Description FR")
  })

  it("lets operators return to base content after selecting a non-default translation", () => {
    const selectedLanguageTag = resolveProductDetailSelectedLanguageTag({
      defaultLanguageTag: "en",
      selectedLanguageTag: "en",
      translations: [frenchTranslation],
    })

    expect(selectedLanguageTag).toBe("en")
    expect(
      resolveProductDetailDescription({
        defaultLanguageTag: "en",
        productDescription: "Description EN",
        selectedLanguageTag,
        translations: [frenchTranslation],
      }),
    ).toBe("Description EN")
  })
})
