// agent-quality: file-size exception -- owner: inventory-react; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
import { Button, Input, Label } from "@voyant-travel/ui/components"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyant-travel/ui/components/combobox"
import { Popover, PopoverContent, PopoverTrigger } from "@voyant-travel/ui/components/popover"
import { RichTextEditor } from "@voyant-travel/ui/components/rich-text-editor"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@voyant-travel/ui/components/tooltip"
import { cn } from "@voyant-travel/ui/lib/utils"
import { languages } from "@voyant-travel/utils/languages"
import { Globe, Plus, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  type ProductTranslationRecord,
  useProductTranslationMutation,
  useProductTranslations,
} from "../../index.js"
import type { useProductDetailMessages } from "./host.js"

type ProductCoreMessages = ReturnType<typeof useProductDetailMessages>["products"]["core"]

export type TranslatableField =
  | "name"
  | "description"
  | "slug"
  | "inclusionsHtml"
  | "exclusionsHtml"
  | "termsHtml"

const RICH_TEXT_FIELDS = new Set<TranslatableField>([
  "description",
  "inclusionsHtml",
  "exclusionsHtml",
  "termsHtml",
])

export type TranslationDraft = {
  id: string | null
  languageTag: string
  name: string
  description: string
  slug: string
  // Carried through on save but not edited in this UI — never wiped.
  shortDescription: string | null
  inclusionsHtml: string | null
  exclusionsHtml: string | null
  termsHtml: string | null
  seoTitle: string | null
  seoDescription: string | null
}

function recordToDraft(record: ProductTranslationRecord): TranslationDraft {
  return {
    id: record.id,
    languageTag: record.languageTag,
    name: record.name,
    description: record.description ?? "",
    slug: record.slug ?? "",
    shortDescription: record.shortDescription,
    inclusionsHtml: record.inclusionsHtml,
    exclusionsHtml: record.exclusionsHtml,
    termsHtml: record.termsHtml,
    seoTitle: record.seoTitle,
    seoDescription: record.seoDescription,
  }
}

function emptyDraft(languageTag: string): TranslationDraft {
  return {
    id: null,
    languageTag,
    name: "",
    description: "",
    slug: "",
    shortDescription: null,
    inclusionsHtml: null,
    exclusionsHtml: null,
    termsHtml: null,
    seoTitle: null,
    seoDescription: null,
  }
}

// Rich text is "set" only when it has visible text, not just empty markup like <p></p>.
export function richTextHasContent(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim().length > 0
  )
}

function fieldHasContent(draft: TranslationDraft, field: TranslatableField): boolean {
  const value = draft[field] ?? ""
  if (RICH_TEXT_FIELDS.has(field)) return richTextHasContent(value)
  return value.trim().length > 0
}

export function languageLabel(tag: string): string {
  const base = tag.split("-")[0]?.toLowerCase() ?? tag
  return (languages as Record<string, string>)[base] ?? tag
}

export interface PersistTranslationsOptions {
  defaultLanguageTag: string
  baseName: string
  baseDescription: string
  baseInclusionsHtml: string
  baseExclusionsHtml: string
  baseTermsHtml: string
}

// Resolve a rich-text translation column: the default-language row mirrors the
// base product column (when it has content), every row otherwise uses its own
// draft, and empty markup collapses to null so the column stays clean.
function resolveRichText(isDefault: boolean, baseValue: string, draftValue: string | null) {
  if (isDefault && richTextHasContent(baseValue)) return baseValue
  return richTextHasContent(draftValue ?? "") ? (draftValue ?? "") : null
}

export interface ProductTranslationDrafts {
  drafts: TranslationDraft[]
  isLoading: boolean
  setFieldValue: (languageTag: string, field: TranslatableField, value: string) => void
  addLanguage: (languageTag: string) => void
  removeLanguage: (languageTag: string) => void
  persist: (productId: string, options: PersistTranslationsOptions) => Promise<void>
}

/**
 * Manages an in-memory draft of a product's translations so Name/Description/
 * Slug can be edited in context from the edit sheet. Seeds from the saved
 * translation records and persists create/update/delete on save.
 *
 * The base product columns hold the default language's Name/Description, so the
 * default-language translation row (if any) just mirrors them and carries the
 * slug (base has no slug column). Fields we don't edit here (short description,
 * inclusions, SEO, …) are preserved untouched.
 */
export function useProductTranslationDrafts(productId: string | null): ProductTranslationDrafts {
  const query = useProductTranslations(productId ?? undefined, {
    limit: 100,
    enabled: !!productId,
  })
  const mutations = useProductTranslationMutation()
  const [drafts, setDrafts] = useState<TranslationDraft[]>([])
  const seededKey = useRef<string | null>(null)
  const existingRef = useRef<ProductTranslationRecord[]>([])

  useEffect(() => {
    const key = productId ?? "__new__"
    if (productId && query.isPending) return
    if (seededKey.current === key) return
    const records = query.data?.data ?? []
    existingRef.current = records
    setDrafts(records.map(recordToDraft))
    seededKey.current = key
  }, [productId, query.isPending, query.data])

  const setFieldValue = useCallback(
    (languageTag: string, field: TranslatableField, value: string) => {
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
    async (resolvedProductId: string, options: PersistTranslationsOptions) => {
      const {
        defaultLanguageTag,
        baseName,
        baseDescription,
        baseInclusionsHtml,
        baseExclusionsHtml,
        baseTermsHtml,
      } = options
      const original = existingRef.current
      const currentLanguages = new Set(drafts.map((draft) => draft.languageTag))

      const deletes = original
        .filter((record) => !currentLanguages.has(record.languageTag))
        .map((record) =>
          mutations.remove.mutateAsync({
            productId: resolvedProductId,
            translationId: record.id,
          }),
        )

      const upserts = drafts.map((draft) => {
        const isDefault = draft.languageTag === defaultLanguageTag
        // The default-language row mirrors the base columns so public serving
        // (which prefers translations) stays consistent with what's edited.
        // When base is empty we keep the row's own value rather than wiping it —
        // legacy products often have empty base columns with content only here.
        const name = isDefault ? baseName : draft.name.trim() || baseName
        const description = isDefault
          ? richTextHasContent(baseDescription)
            ? baseDescription
            : richTextHasContent(draft.description)
              ? draft.description
              : null
          : richTextHasContent(draft.description)
            ? draft.description
            : null
        const slug = draft.slug.trim() ? draft.slug.trim() : null
        const inclusionsHtml = resolveRichText(isDefault, baseInclusionsHtml, draft.inclusionsHtml)
        const exclusionsHtml = resolveRichText(isDefault, baseExclusionsHtml, draft.exclusionsHtml)
        const termsHtml = resolveRichText(isDefault, baseTermsHtml, draft.termsHtml)
        const richInput = { inclusionsHtml, exclusionsHtml, termsHtml }

        if (draft.id) {
          return mutations.update.mutateAsync({
            productId: resolvedProductId,
            translationId: draft.id,
            input: { name, description, slug, ...richInput },
          })
        }

        // A brand-new row is only worth creating once it carries content.
        const hasRichContent = !!inclusionsHtml || !!exclusionsHtml || !!termsHtml
        const isEmpty = isDefault
          ? !slug && !hasRichContent
          : !draft.name.trim() && !richTextHasContent(draft.description) && !slug && !hasRichContent
        if (isEmpty) return Promise.resolve(null)

        return mutations.create.mutateAsync({
          productId: resolvedProductId,
          input: { languageTag: draft.languageTag, name, description, slug, ...richInput },
        })
      })

      await Promise.all([...deletes, ...upserts])
      // Force a reseed from the refreshed server state so a second save patches
      // (with real ids) instead of re-creating.
      seededKey.current = null
    },
    [drafts, mutations],
  )

  return {
    drafts,
    isLoading: !!productId && query.isPending,
    setFieldValue,
    addLanguage,
    removeLanguage,
    persist,
  }
}

export interface ContentLanguageSwitcherProps {
  activeLanguage: string
  defaultLanguageTag: string
  /** The language tags that currently have a translation draft (excluding the default). */
  languageTags: string[]
  messages: ProductCoreMessages
  onSelect: (languageTag: string) => void
  onAddLanguage: (languageTag: string) => void
  onRemoveLanguage: (languageTag: string) => void
}

/** Top-of-sheet switcher: picks which language every translatable field edits. */
export function ContentLanguageSwitcher({
  activeLanguage,
  defaultLanguageTag,
  languageTags,
  messages,
  onSelect,
  onAddLanguage,
  onRemoveLanguage,
}: ContentLanguageSwitcherProps) {
  const [addOpen, setAddOpen] = useState(false)
  const otherLanguages = languageTags.filter((tag) => tag !== defaultLanguageTag)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {messages.editingLanguageLabel}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <LanguageChip
          active={activeLanguage === defaultLanguageTag}
          languageTag={defaultLanguageTag}
          badge={messages.defaultBadge}
          onSelect={() => onSelect(defaultLanguageTag)}
        />
        {otherLanguages.map((tag) => (
          <LanguageChip
            key={tag}
            active={activeLanguage === tag}
            languageTag={tag}
            onSelect={() => onSelect(tag)}
            onRemove={() => onRemoveLanguage(tag)}
            removeLabel={messages.translationRemoveLanguage}
          />
        ))}
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger
            render={
              <Button type="button" variant="outline" size="sm" className="h-7 border-dashed">
                <Plus className="size-3.5" />
                {messages.addLanguage}
              </Button>
            }
          />
          <PopoverContent align="start" className="w-64">
            <LanguageCombobox
              value=""
              exclude={[defaultLanguageTag, ...otherLanguages]}
              placeholder={messages.translationLanguageSearch}
              emptyLabel={messages.translationLanguageEmpty}
              onValueChange={(code) => {
                if (code) {
                  onAddLanguage(code)
                  setAddOpen(false)
                }
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

function LanguageChip({
  active,
  languageTag,
  badge,
  onSelect,
  onRemove,
  removeLabel,
}: {
  active: boolean
  languageTag: string
  badge?: string
  onSelect: () => void
  onRemove?: () => void
  removeLabel?: string
}) {
  const removeAccessibleLabel = removeLabel
    ? `${removeLabel}: ${languageLabel(languageTag)}`
    : languageLabel(languageTag)

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-input text-muted-foreground hover:bg-accent",
      )}
    >
      <button type="button" onClick={onSelect} className="inline-flex items-center gap-1.5">
        <span className="font-medium">{languageLabel(languageTag)}</span>
        <span className="font-mono uppercase opacity-70">{languageTag}</span>
        {badge ? (
          <span className="rounded bg-muted px-1 text-[10px] font-medium uppercase tracking-wide">
            {badge}
          </span>
        ) : null}
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeAccessibleLabel}
          title={removeAccessibleLabel}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  )
}

export interface TranslatableFieldProps {
  id: string
  label: string
  type: "text" | "richtext"
  field: TranslatableField
  activeLanguage: string
  defaultLanguageTag: string
  /** The base product value (used when the active language is the default). Omit for slug. */
  base?: { value: string; onChange: (value: string) => void }
  translations: ProductTranslationDrafts
  messages: ProductCoreMessages
  placeholder?: string
  autoFocus?: boolean
  error?: string
}

/**
 * A field bound to the sheet's active language. When that's the default
 * language (and the field has a base column), it edits the base value;
 * otherwise it edits the active language's translation draft. The globe is an
 * informational indicator (green when the field has any non-default translation).
 */
export function TranslatableField({
  id,
  label,
  type,
  field,
  activeLanguage,
  defaultLanguageTag,
  base,
  translations,
  messages,
  placeholder,
  autoFocus,
  error,
}: TranslatableFieldProps) {
  const usesBase = !!base && activeLanguage === defaultLanguageTag
  const activeDraft = translations.drafts.find((draft) => draft.languageTag === activeLanguage)
  const defaultDraft = translations.drafts.find((draft) => draft.languageTag === defaultLanguageTag)
  // When editing the default language, show the base value — but fall back to
  // the default-language translation (legacy products keep content only there).
  // Editing writes to the base columns, promoting that content forward.
  const value = usesBase
    ? (base?.value ?? "") || (defaultDraft?.[field] ?? "")
    : (activeDraft?.[field] ?? "")
  const handleChange = usesBase
    ? (base?.onChange ?? (() => {}))
    : (next: string) => translations.setFieldValue(activeLanguage, field, next)

  const translatedLanguages = translations.drafts
    .filter((draft) => draft.languageTag !== defaultLanguageTag && fieldHasContent(draft, field))
    .map((draft) => draft.languageTag)
  const labelId = `${id}-label`
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Label id={labelId} htmlFor={id}>
          {label}
        </Label>
        <TranslationIndicator languages={translatedLanguages} messages={messages} />
      </div>
      {type === "richtext" ? (
        <RichTextEditor
          id={id}
          aria-labelledby={labelId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          editorClassName="max-h-[280px] overflow-y-auto"
        />
      ) : (
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
      )}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function TranslationIndicator({
  languages: translatedLanguages,
  messages,
}: {
  languages: string[]
  messages: ProductCoreMessages
}) {
  const isTranslated = translatedLanguages.length > 0
  const indicatorLabel = isTranslated
    ? `${messages.fieldTranslated}: ${translatedLanguages.map((tag) => tag.toUpperCase()).join(", ")}`
    : messages.fieldNotTranslated

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={indicatorLabel}
              title={indicatorLabel}
              className="inline-flex cursor-help items-center"
            >
              <Globe
                className={cn(
                  "size-3.5",
                  isTranslated ? "text-emerald-500" : "text-muted-foreground/50",
                )}
              />
            </button>
          }
        />
        <TooltipContent>{indicatorLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function LanguageCombobox({
  id,
  value,
  onValueChange,
  exclude = [],
  placeholder,
  emptyLabel,
}: {
  id?: string
  value: string
  onValueChange: (languageTag: string) => void
  exclude?: string[]
  placeholder?: string
  emptyLabel?: string
}) {
  const excludeKey = exclude.join("|")
  const codes = useMemo(
    () => Object.keys(languages).filter((code) => !excludeKey.split("|").includes(code)),
    [excludeKey],
  )
  const labelForCode = useCallback(
    (code: string) => (languages as Record<string, string>)[code] ?? code,
    [],
  )

  return (
    <Combobox
      items={codes}
      value={value}
      onValueChange={(next) => onValueChange(next ?? "")}
      itemToStringLabel={(code) => labelForCode(code as string)}
      filter={(code, query) => {
        const needle = query.trim().toLowerCase()
        if (!needle) return true
        const codeValue = code as string
        return labelForCode(codeValue).toLowerCase().includes(needle) || codeValue.includes(needle)
      }}
    >
      <ComboboxInput
        id={id}
        aria-label={id ? undefined : placeholder}
        placeholder={placeholder}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxCollection>
            {(code) => (
              <ComboboxItem key={code as string} value={code as string}>
                <span className="truncate">{labelForCode(code as string)}</span>
                <span className="font-mono text-xs text-muted-foreground">{code as string}</span>
              </ComboboxItem>
            )}
          </ComboboxCollection>
          <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
