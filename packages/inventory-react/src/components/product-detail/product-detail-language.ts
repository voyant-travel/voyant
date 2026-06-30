import type { ProductTranslationRecord } from "../../index.js"

type ProductDetailTranslation = Pick<ProductTranslationRecord, "languageTag" | "description">

function normalizeLanguageTag(languageTag: string | null | undefined): string {
  return languageTag?.trim().toLowerCase() ?? ""
}

function findTranslationByLanguageTag(
  translations: ProductDetailTranslation[],
  languageTag: string | null | undefined,
): ProductDetailTranslation | null {
  const normalized = normalizeLanguageTag(languageTag)
  if (!normalized) return null
  return (
    translations.find(
      (translation) => normalizeLanguageTag(translation.languageTag) === normalized,
    ) ?? null
  )
}

export function resolveProductDetailSelectedLanguageTag({
  defaultLanguageTag,
  selectedLanguageTag,
  translations,
}: {
  defaultLanguageTag: string | null | undefined
  selectedLanguageTag: string
  translations: ProductDetailTranslation[]
}): string {
  const normalizedDefaultLanguageTag = normalizeLanguageTag(defaultLanguageTag)
  if (
    normalizedDefaultLanguageTag &&
    normalizeLanguageTag(selectedLanguageTag) === normalizedDefaultLanguageTag
  ) {
    return defaultLanguageTag?.trim() ?? selectedLanguageTag
  }

  const selectedTranslation = findTranslationByLanguageTag(translations, selectedLanguageTag)
  if (selectedTranslation) return selectedTranslation.languageTag

  const defaultTranslation = findTranslationByLanguageTag(translations, defaultLanguageTag)
  return defaultTranslation?.languageTag ?? defaultLanguageTag?.trim() ?? ""
}

export function resolveProductDetailBaseLanguageToggleTag({
  defaultLanguageTag,
  translations,
}: {
  defaultLanguageTag: string | null | undefined
  translations: ProductDetailTranslation[]
}): string {
  const normalizedDefaultLanguageTag = normalizeLanguageTag(defaultLanguageTag)
  if (!normalizedDefaultLanguageTag) return ""
  return findTranslationByLanguageTag(translations, defaultLanguageTag)
    ? ""
    : (defaultLanguageTag?.trim() ?? "")
}

export function resolveProductDetailDescription({
  defaultLanguageTag,
  productDescription,
  selectedLanguageTag,
  translations,
}: {
  defaultLanguageTag: string | null | undefined
  productDescription: string | null
  selectedLanguageTag: string
  translations: ProductDetailTranslation[]
}): string | null {
  const selectedTranslation = findTranslationByLanguageTag(translations, selectedLanguageTag)
  const selectedLanguageIsDefault =
    !!selectedTranslation &&
    normalizeLanguageTag(selectedTranslation.languageTag) ===
      normalizeLanguageTag(defaultLanguageTag)

  if (selectedLanguageIsDefault) {
    return productDescription ?? selectedTranslation.description ?? null
  }

  return selectedTranslation?.description ?? productDescription ?? null
}
