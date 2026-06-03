import {
  type ProductDayTranslationRecord,
  useProductDayTranslationMutation,
  useProductDayTranslations,
} from "@voyantjs/products-react"
import { Input, Label } from "@voyantjs/ui/components"
import { RichTextEditor } from "@voyantjs/ui/components/rich-text-editor"
import { useCallback, useEffect, useRef, useState } from "react"
import type { useProductDetailMessages } from "./host.js"
import { richTextHasContent, TranslationIndicator } from "./product-translation-popover"

type ProductCoreMessages = ReturnType<typeof useProductDetailMessages>["products"]["core"]

export type DayTranslatableField = "title" | "description" | "location"

export type DayTranslationDraft = {
  id: string | null
  languageTag: string
  title: string
  description: string
  location: string
}

function recordToDraft(record: ProductDayTranslationRecord): DayTranslationDraft {
  return {
    id: record.id,
    languageTag: record.languageTag,
    title: record.title ?? "",
    description: record.description ?? "",
    location: record.location ?? "",
  }
}

function emptyDraft(languageTag: string): DayTranslationDraft {
  return { id: null, languageTag, title: "", description: "", location: "" }
}

function fieldHasContent(draft: DayTranslationDraft, field: DayTranslatableField): boolean {
  if (field === "description") return richTextHasContent(draft.description)
  return draft[field].trim().length > 0
}

export interface ProductDayTranslationDrafts {
  drafts: DayTranslationDraft[]
  setFieldValue: (languageTag: string, field: DayTranslatableField, value: string) => void
  addLanguage: (languageTag: string) => void
  removeLanguage: (languageTag: string) => void
  persist: (productId: string, dayId: string, defaultLanguageTag: string) => Promise<void>
}

/**
 * In-memory drafts for a day's translations. The default language's content
 * lives in the base day columns (title/description/location all have base
 * columns), so this only manages non-default-language translation rows.
 */
export function useProductDayTranslationDrafts(
  productId: string | null,
  dayId: string | null,
): ProductDayTranslationDrafts {
  const query = useProductDayTranslations(productId ?? undefined, dayId ?? undefined, {
    enabled: !!productId && !!dayId,
  })
  const mutations = useProductDayTranslationMutation()
  const [drafts, setDrafts] = useState<DayTranslationDraft[]>([])
  const seededKey = useRef<string | null>(null)
  const existingRef = useRef<ProductDayTranslationRecord[]>([])

  useEffect(() => {
    const key = `${productId ?? ""}:${dayId ?? "__new__"}`
    if (productId && dayId && query.isPending) return
    if (seededKey.current === key) return
    const records = query.data?.data ?? []
    existingRef.current = records
    setDrafts(records.map(recordToDraft))
    seededKey.current = key
  }, [productId, dayId, query.isPending, query.data])

  const setFieldValue = useCallback(
    (languageTag: string, field: DayTranslatableField, value: string) => {
      setDrafts((prev) => {
        if (prev.some((draft) => draft.languageTag === languageTag)) {
          return prev.map((draft) =>
            draft.languageTag === languageTag ? { ...draft, [field]: value } : draft,
          )
        }
        return [...prev, { ...emptyDraft(languageTag), [field]: value }]
      })
    },
    [],
  )

  const addLanguage = useCallback((languageTag: string) => {
    setDrafts((prev) =>
      prev.some((draft) => draft.languageTag === languageTag)
        ? prev
        : [...prev, emptyDraft(languageTag)],
    )
  }, [])

  const removeLanguage = useCallback((languageTag: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.languageTag !== languageTag))
  }, [])

  const persist = useCallback(
    async (resolvedProductId: string, resolvedDayId: string, defaultLanguageTag: string) => {
      const original = existingRef.current
      const nonDefault = drafts.filter((draft) => draft.languageTag !== defaultLanguageTag)
      const currentLanguages = new Set(nonDefault.map((draft) => draft.languageTag))

      const deletes = original
        .filter((record) => !currentLanguages.has(record.languageTag))
        .map((record) =>
          mutations.remove.mutateAsync({
            productId: resolvedProductId,
            dayId: resolvedDayId,
            translationId: record.id,
          }),
        )

      const upserts = nonDefault.map((draft) => {
        const title = draft.title.trim() ? draft.title.trim() : null
        const description = richTextHasContent(draft.description) ? draft.description : null
        const location = draft.location.trim() ? draft.location.trim() : null

        if (draft.id) {
          return mutations.update.mutateAsync({
            productId: resolvedProductId,
            dayId: resolvedDayId,
            translationId: draft.id,
            input: { title, description, location },
          })
        }

        if (!title && !description && !location) return Promise.resolve(null)

        return mutations.create.mutateAsync({
          productId: resolvedProductId,
          dayId: resolvedDayId,
          input: { languageTag: draft.languageTag, title, description, location },
        })
      })

      await Promise.all([...deletes, ...upserts])
      seededKey.current = null
    },
    [drafts, mutations],
  )

  return { drafts, setFieldValue, addLanguage, removeLanguage, persist }
}

export interface DayTranslatableFieldProps {
  label: string
  type: "text" | "richtext"
  field: DayTranslatableField
  activeLanguage: string
  defaultLanguageTag: string
  base: { value: string; onChange: (value: string) => void }
  drafts: ProductDayTranslationDrafts
  messages: ProductCoreMessages
  placeholder?: string
  autoFocus?: boolean
}

export function DayTranslatableField({
  label,
  type,
  field,
  activeLanguage,
  defaultLanguageTag,
  base,
  drafts,
  messages,
  placeholder,
  autoFocus,
}: DayTranslatableFieldProps) {
  const usesBase = activeLanguage === defaultLanguageTag
  const activeDraft = drafts.drafts.find((draft) => draft.languageTag === activeLanguage)
  const value = usesBase ? base.value : (activeDraft?.[field] ?? "")
  const handleChange = usesBase
    ? base.onChange
    : (next: string) => drafts.setFieldValue(activeLanguage, field, next)

  const translatedLanguages = drafts.drafts
    .filter((draft) => draft.languageTag !== defaultLanguageTag && fieldHasContent(draft, field))
    .map((draft) => draft.languageTag)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        <TranslationIndicator languages={translatedLanguages} messages={messages} />
      </div>
      {type === "richtext" ? (
        <RichTextEditor
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          editorClassName="max-h-[320px] overflow-y-auto"
        />
      ) : (
        <Input
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
      )}
    </div>
  )
}
