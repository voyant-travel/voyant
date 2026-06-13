import {
  Button,
  Input,
  Label,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { ProductsUiMessagesProvider } from "../../i18n/index.js"
import { type ProductDayRecord, useProduct, useProductDayMutation } from "../../index.js"
import { ProductDayMediaTray } from "../product-day-media-tray.js"
import type { ProductMediaUploadHandler } from "../product-media-section.js"
import { useProductDetailMessages, useProductLocale } from "./host.js"
import { DayTranslatableField, useProductDayTranslationDrafts } from "./product-day-translation.js"
import { ContentLanguageSwitcher, richTextHasContent } from "./product-translation-popover.js"

export interface ProductDaySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  itineraryId?: string
  day?: ProductDayRecord
  nextDayNumber?: number
  uploadMedia?: ProductMediaUploadHandler
  onSuccess?: (day: ProductDayRecord) => void
}

export function ProductDaySheet({
  open,
  onOpenChange,
  productId,
  itineraryId,
  day,
  nextDayNumber,
  uploadMedia,
  onSuccess,
}: ProductDaySheetProps) {
  const messages = useProductDetailMessages()
  const productMessages = messages.products.core
  const resolvedLocale = useProductLocale()
  const isEdit = !!day

  const productQuery = useProduct(productId)
  const adminBaseLocale = resolvedLocale.split("-")[0]?.toLowerCase() || "en"
  const defaultLanguageTag = productQuery.data?.defaultLanguageTag?.trim() || adminBaseLocale

  const [dayNumber, setDayNumber] = useState("1")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [error, setError] = useState<string | null>(null)

  const dayMutation = useProductDayMutation()
  const translations = useProductDayTranslationDrafts(productId, day?.id ?? null)
  const [activeLanguage, setActiveLanguage] = useState(defaultLanguageTag)

  useEffect(() => {
    setActiveLanguage(defaultLanguageTag)
  }, [defaultLanguageTag])

  // Reset the base fields whenever the sheet opens for a different day.
  useEffect(() => {
    if (!open) return
    setDayNumber(String(day?.dayNumber ?? nextDayNumber ?? 1))
    setTitle(day?.title ?? "")
    setDescription(day?.description ?? "")
    setLocation(day?.location ?? "")
    setError(null)
  }, [open, day, nextDayNumber])

  const isSubmitting = dayMutation.create.isPending || dayMutation.update.isPending

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const parsedDayNumber = Number.parseInt(dayNumber || "0", 10)
    if (!Number.isFinite(parsedDayNumber) || parsedDayNumber < 1) {
      setError(productMessages.dayNumberMin)
      return
    }

    const payload = {
      dayNumber: parsedDayNumber,
      title: title.trim() ? title.trim() : null,
      description: richTextHasContent(description) ? description : null,
      location: location.trim() ? location.trim() : null,
    }

    try {
      const savedDay = isEdit
        ? await dayMutation.update.mutateAsync({ productId, dayId: day.id, input: payload })
        : await dayMutation.create.mutateAsync({ productId, itineraryId, ...payload })
      await translations.persist(productId, savedDay.id, defaultLanguageTag)
      onSuccess?.(savedDay)
      onOpenChange(false)
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : productMessages.daySaveFailed,
      )
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? productMessages.daySheetEditTitle : productMessages.daySheetNewTitle}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <ContentLanguageSwitcher
              activeLanguage={activeLanguage}
              defaultLanguageTag={defaultLanguageTag}
              languageTags={translations.drafts.map((draft) => draft.languageTag)}
              messages={productMessages}
              onSelect={setActiveLanguage}
              onAddLanguage={(code) => {
                translations.addLanguage(code)
                setActiveLanguage(code)
              }}
              onRemoveLanguage={(code) => {
                translations.removeLanguage(code)
                if (activeLanguage === code) setActiveLanguage(defaultLanguageTag)
              }}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product-day-number">{productMessages.dayNumberLabel}</Label>
                <Input
                  id="product-day-number"
                  type="number"
                  min="1"
                  required
                  value={dayNumber}
                  onChange={(event) => setDayNumber(event.target.value)}
                />
              </div>
              <DayTranslatableField
                field="location"
                type="text"
                label={productMessages.dayLocationLabel}
                activeLanguage={activeLanguage}
                defaultLanguageTag={defaultLanguageTag}
                base={{ value: location, onChange: setLocation }}
                drafts={translations}
                messages={productMessages}
                placeholder={productMessages.dayLocationPlaceholder}
              />
            </div>

            <DayTranslatableField
              field="title"
              type="text"
              label={productMessages.dayTitleLabel}
              activeLanguage={activeLanguage}
              defaultLanguageTag={defaultLanguageTag}
              base={{ value: title, onChange: setTitle }}
              drafts={translations}
              messages={productMessages}
              placeholder={productMessages.dayTitlePlaceholder}
              autoFocus
            />

            <DayTranslatableField
              field="description"
              type="richtext"
              label={productMessages.dayDescriptionLabel}
              activeLanguage={activeLanguage}
              defaultLanguageTag={defaultLanguageTag}
              base={{ value: description, onChange: setDescription }}
              drafts={translations}
              messages={productMessages}
              placeholder={productMessages.dayDescriptionPlaceholder}
            />

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {isEdit ? (
              <div className="border-t pt-4">
                <ProductsUiMessagesProvider locale={resolvedLocale}>
                  <ProductDayMediaTray
                    productId={productId}
                    dayId={day.id}
                    uploadMedia={uploadMedia}
                  />
                </ProductsUiMessagesProvider>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {productMessages.cancel}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {isEdit ? productMessages.saveDay : productMessages.addDay}
              </Button>
            </div>
          </form>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
