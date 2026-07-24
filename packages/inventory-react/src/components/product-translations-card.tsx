"use client"

import { confirmDialog } from "@voyant-travel/ui/components"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components/card"
import { Input } from "@voyant-travel/ui/components/input"
import { Label } from "@voyant-travel/ui/components/label"
import { RichTextEditor } from "@voyant-travel/ui/components/rich-text-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components/select"
import { Textarea } from "@voyant-travel/ui/components/textarea"
import { Copy, Languages, Loader2, Plus, Save, Trash2 } from "lucide-react"
import * as React from "react"
import { useProductsUiMessagesOrDefault } from "../i18n/provider.js"
import {
  type CreateProductTranslationInput,
  type ProductRecord,
  type ProductTranslationRecord,
  type UpdateProductTranslationInput,
  useProductTranslationMutation,
  useProductTranslations,
} from "../index.js"

export interface ProductTranslationsCardProps {
  product: ProductRecord
  className?: string
}

type TranslationFormState = {
  languageTag: string
  slug: string
  name: string
  shortDescription: string
  description: string
  inclusionsHtml: string
  exclusionsHtml: string
  termsHtml: string
  seoTitle: string
  seoDescription: string
}

function emptyTranslationState(languageTag = ""): TranslationFormState {
  return {
    languageTag,
    slug: "",
    name: "",
    shortDescription: "",
    description: "",
    inclusionsHtml: "",
    exclusionsHtml: "",
    termsHtml: "",
    seoTitle: "",
    seoDescription: "",
  }
}

function translationToState(translation: ProductTranslationRecord): TranslationFormState {
  return {
    languageTag: translation.languageTag,
    slug: translation.slug ?? "",
    name: translation.name,
    shortDescription: translation.shortDescription ?? "",
    description: translation.description ?? "",
    inclusionsHtml: translation.inclusionsHtml ?? "",
    exclusionsHtml: translation.exclusionsHtml ?? "",
    termsHtml: translation.termsHtml ?? "",
    seoTitle: translation.seoTitle ?? "",
    seoDescription: translation.seoDescription ?? "",
  }
}

function normalizeOptional(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeLanguageTag(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""

  try {
    return Intl.getCanonicalLocales(trimmed)[0] ?? trimmed
  } catch {
    return trimmed
  }
}

function toPayload(
  state: TranslationFormState,
): CreateProductTranslationInput | UpdateProductTranslationInput {
  return {
    languageTag: normalizeLanguageTag(state.languageTag),
    slug: normalizeOptional(state.slug),
    name: state.name.trim(),
    shortDescription: normalizeOptional(state.shortDescription),
    description: normalizeOptional(state.description),
    inclusionsHtml: normalizeOptional(state.inclusionsHtml),
    exclusionsHtml: normalizeOptional(state.exclusionsHtml),
    termsHtml: normalizeOptional(state.termsHtml),
    seoTitle: normalizeOptional(state.seoTitle),
    seoDescription: normalizeOptional(state.seoDescription),
  }
}

export function ProductTranslationsCard({ product, className }: ProductTranslationsCardProps) {
  const messages = useProductsUiMessagesOrDefault()
  const cardMessages = messages.productTranslationsCard
  const translationsQuery = useProductTranslations(product.id, { limit: 100 })
  const mutations = useProductTranslationMutation()
  const translations = translationsQuery.data?.data ?? []
  const [selectedLanguageTag, setSelectedLanguageTag] = React.useState("")
  const [newLanguageTag, setNewLanguageTag] = React.useState("")
  const [state, setState] = React.useState<TranslationFormState>(() => emptyTranslationState())
  const [error, setError] = React.useState<string | null>(null)
  const baseId = React.useId()

  const selectedTranslation =
    translations.find((translation) => translation.languageTag === selectedLanguageTag) ?? null
  const isSaving = mutations.create.isPending || mutations.update.isPending
  const isDeleting = mutations.remove.isPending

  React.useEffect(() => {
    if (!selectedLanguageTag && translations.length > 0) {
      setSelectedLanguageTag(translations[0]?.languageTag ?? "")
    }
  }, [selectedLanguageTag, translations])

  React.useEffect(() => {
    if (selectedTranslation) {
      setState(translationToState(selectedTranslation))
      return
    }

    if (selectedLanguageTag) {
      setState(emptyTranslationState(selectedLanguageTag))
    }
  }, [selectedLanguageTag, selectedTranslation])

  const field =
    <K extends keyof TranslationFormState>(key: K) =>
    (value: TranslationFormState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }))
    }

  const handleAddLanguage = () => {
    setError(null)
    const normalized = normalizeLanguageTag(newLanguageTag)

    if (!normalized) {
      setError(cardMessages.states.languageRequired)
      return
    }

    setSelectedLanguageTag(normalized)
    setState(emptyTranslationState(normalized))
    setNewLanguageTag("")
  }

  const handleCopyBase = () => {
    setState((prev) => ({
      ...prev,
      name: product.name,
      shortDescription: "",
      description: product.description ?? "",
      inclusionsHtml: product.inclusionsHtml ?? "",
      exclusionsHtml: product.exclusionsHtml ?? "",
      termsHtml: product.termsHtml ?? "",
      seoTitle: product.name,
      seoDescription: product.description ?? "",
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const languageTag = normalizeLanguageTag(state.languageTag)
    if (!languageTag) {
      setError(cardMessages.states.languageRequired)
      return
    }

    if (!state.name.trim()) {
      setError(cardMessages.states.nameRequired)
      return
    }

    try {
      const payload = toPayload({ ...state, languageTag })
      if (selectedTranslation) {
        const { translation } = await mutations.update.mutateAsync({
          productId: product.id,
          translationId: selectedTranslation.id,
          input: payload as UpdateProductTranslationInput,
        })
        setSelectedLanguageTag(translation.languageTag)
      } else {
        const translation = await mutations.create.mutateAsync({
          productId: product.id,
          input: payload as CreateProductTranslationInput,
        })
        setSelectedLanguageTag(translation.languageTag)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : cardMessages.states.saveFailed)
    }
  }

  const handleDelete = async () => {
    if (!selectedTranslation) return
    setError(null)

    if (
      !(await confirmDialog({
        description: cardMessages.states.deleteConfirm.replace(
          "{languageTag}",
          selectedTranslation.languageTag,
        ),
        destructive: true,
      }))
    ) {
      return
    }

    try {
      await mutations.remove.mutateAsync({
        productId: product.id,
        translationId: selectedTranslation.id,
      })
      const next = translations.find((translation) => translation.id !== selectedTranslation.id)
      setSelectedLanguageTag(next?.languageTag ?? "")
      setState(emptyTranslationState(next?.languageTag ?? ""))
    } catch (err) {
      setError(err instanceof Error ? err.message : cardMessages.states.deleteFailed)
    }
  }

  return (
    <Card data-slot="product-translations-card" className={className}>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <CardTitle>{cardMessages.title}</CardTitle>
            <CardDescription>{cardMessages.description}</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex min-w-40 flex-col gap-1.5">
              <Label htmlFor={`${baseId}-language-select`}>
                {cardMessages.languageSelectLabel}
              </Label>
              <Select
                value={selectedLanguageTag}
                onValueChange={(value) => {
                  setError(null)
                  setSelectedLanguageTag(value ?? "")
                }}
                disabled={translations.length === 0 && !selectedLanguageTag}
              >
                <SelectTrigger id={`${baseId}-language-select`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {translations.map((translation) => (
                    <SelectItem key={translation.id} value={translation.languageTag}>
                      {translation.languageTag}
                    </SelectItem>
                  ))}
                  {selectedLanguageTag &&
                  !translations.some(
                    (translation) => translation.languageTag === selectedLanguageTag,
                  ) ? (
                    <SelectItem value={selectedLanguageTag}>{selectedLanguageTag}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 sm:min-w-40">
              <Label htmlFor={`${baseId}-new-language`}>{cardMessages.newLanguageLabel}</Label>
              <div className="flex gap-2">
                <Input
                  id={`${baseId}-new-language`}
                  value={newLanguageTag}
                  onChange={(event) => setNewLanguageTag(event.target.value)}
                  placeholder={cardMessages.placeholders.newLanguage}
                />
                <Button type="button" variant="outline" onClick={handleAddLanguage}>
                  <Plus className="size-4" aria-hidden="true" />
                  {cardMessages.actions.addLanguage}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {translationsQuery.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {cardMessages.states.loading}
          </div>
        ) : null}

        {translationsQuery.isError ? (
          <p className="text-sm text-destructive">
            {translationsQuery.error instanceof Error
              ? translationsQuery.error.message
              : cardMessages.states.loadFailed}
          </p>
        ) : null}

        {!translationsQuery.isPending && translations.length === 0 && !selectedLanguageTag ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Languages className="size-4" aria-hidden="true" />
            {cardMessages.states.noTranslations}
          </div>
        ) : null}

        {translations.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {translations.map((translation) => (
              <Badge
                key={translation.id}
                variant={translation.languageTag === selectedLanguageTag ? "default" : "outline"}
              >
                {translation.languageTag}
              </Badge>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${baseId}-language-tag`}>{cardMessages.fields.languageTag}</Label>
              <Input
                id={`${baseId}-language-tag`}
                required
                value={state.languageTag}
                onChange={(event) => field("languageTag")(event.target.value)}
                placeholder={cardMessages.placeholders.languageTag}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${baseId}-slug`}>{cardMessages.fields.slug}</Label>
              <Input
                id={`${baseId}-slug`}
                value={state.slug}
                onChange={(event) => field("slug")(event.target.value)}
                placeholder={cardMessages.placeholders.slug}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${baseId}-name`}>{cardMessages.fields.name}</Label>
              <Input
                id={`${baseId}-name`}
                required
                value={state.name}
                onChange={(event) => field("name")(event.target.value)}
                placeholder={cardMessages.placeholders.name}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${baseId}-short-description`}>
                {cardMessages.fields.shortDescription}
              </Label>
              <Input
                id={`${baseId}-short-description`}
                value={state.shortDescription}
                onChange={(event) => field("shortDescription")(event.target.value)}
                placeholder={cardMessages.placeholders.shortDescription}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${baseId}-description`}>{cardMessages.fields.description}</Label>
            <Textarea
              id={`${baseId}-description`}
              value={state.description}
              onChange={(event) => field("description")(event.target.value)}
              placeholder={cardMessages.placeholders.description}
            />
          </div>

          <div className="grid gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{cardMessages.fields.inclusions}</Label>
              <RichTextEditor
                value={state.inclusionsHtml}
                onChange={field("inclusionsHtml")}
                placeholder={cardMessages.placeholders.inclusions}
                editorClassName="max-h-[320px] overflow-y-auto"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{cardMessages.fields.exclusions}</Label>
              <RichTextEditor
                value={state.exclusionsHtml}
                onChange={field("exclusionsHtml")}
                placeholder={cardMessages.placeholders.exclusions}
                editorClassName="max-h-[320px] overflow-y-auto"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{cardMessages.fields.terms}</Label>
              <RichTextEditor
                value={state.termsHtml}
                onChange={field("termsHtml")}
                placeholder={cardMessages.placeholders.terms}
                editorClassName="max-h-[320px] overflow-y-auto"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${baseId}-seo-title`}>{cardMessages.fields.seoTitle}</Label>
              <Input
                id={`${baseId}-seo-title`}
                value={state.seoTitle}
                onChange={(event) => field("seoTitle")(event.target.value)}
                placeholder={cardMessages.placeholders.seoTitle}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${baseId}-seo-description`}>
                {cardMessages.fields.seoDescription}
              </Label>
              <Textarea
                id={`${baseId}-seo-description`}
                value={state.seoDescription}
                onChange={(event) => field("seoDescription")(event.target.value)}
                placeholder={cardMessages.placeholders.seoDescription}
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCopyBase}>
              <Copy className="size-4" aria-hidden="true" />
              {cardMessages.actions.copyBase}
            </Button>
            {selectedTranslation ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
                {isDeleting ? cardMessages.actions.deleting : cardMessages.actions.delete}
              </Button>
            ) : null}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {isSaving ? cardMessages.actions.saving : cardMessages.actions.save}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
