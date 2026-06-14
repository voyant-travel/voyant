"use client"

import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { RichTextEditor } from "@voyantjs/ui/components/rich-text-editor"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { useProductsUiMessagesOrDefault } from "../i18n/provider.js"
import { type ProductDayRecord, useProductDayMutation } from "../index.js"

type Mode =
  | { kind: "create"; productId: string; itineraryId?: string; nextDayNumber?: number }
  | { kind: "edit"; productId: string; day: ProductDayRecord }

export interface ProductDayFormProps {
  mode: Mode
  onSuccess?: (day: ProductDayRecord) => void
  onCancel?: () => void
}

interface FormState {
  dayNumber: string
  title: string
  description: string
  location: string
}

function initialState(mode: Mode): FormState {
  if (mode.kind === "edit") {
    return {
      dayNumber: String(mode.day.dayNumber),
      title: mode.day.title ?? "",
      description: mode.day.description ?? "",
      location: mode.day.location ?? "",
    }
  }

  return {
    dayNumber: String(mode.nextDayNumber ?? 1),
    title: "",
    description: "",
    location: "",
  }
}

export function ProductDayForm({ mode, onSuccess, onCancel }: ProductDayFormProps) {
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = useProductDayMutation()
  const messages = useProductsUiMessagesOrDefault()

  React.useEffect(() => {
    setState(initialState(mode))
    setError(null)
  }, [mode])

  const isSubmitting = create.isPending || update.isPending

  const field =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) => {
      setState((previous) => ({ ...previous, [key]: value }))
    }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const dayNumber = Number.parseInt(state.dayNumber || "0", 10)
    if (!Number.isFinite(dayNumber) || dayNumber < 1) {
      setError(messages.productDayForm.validation.dayNumberMin)
      return
    }

    const payload = {
      dayNumber,
      title: state.title.trim() ? state.title.trim() : null,
      description: state.description.trim() ? state.description.trim() : null,
      location: state.location.trim() ? state.location.trim() : null,
    }

    try {
      const day =
        mode.kind === "create"
          ? await create.mutateAsync({
              productId: mode.productId,
              itineraryId: mode.itineraryId,
              ...payload,
            })
          : await update.mutateAsync({
              productId: mode.productId,
              dayId: mode.day.id,
              input: payload,
            })
      onSuccess?.(day)
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : messages.productDayForm.validation.saveFailed,
      )
    }
  }

  return (
    <form data-slot="product-day-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-day-number">{messages.productDayForm.fields.dayNumber}</Label>
          <Input
            id="product-day-number"
            type="number"
            min="1"
            autoFocus
            required
            value={state.dayNumber}
            onChange={(event) => field("dayNumber")(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-day-location">{messages.productDayForm.fields.location}</Label>
          <Input
            id="product-day-location"
            value={state.location}
            onChange={(event) => field("location")(event.target.value)}
            placeholder={messages.productDayForm.placeholders.location}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-day-title">{messages.productDayForm.fields.title}</Label>
        <Input
          id="product-day-title"
          value={state.title}
          onChange={(event) => field("title")(event.target.value)}
          placeholder={messages.productDayForm.placeholders.title}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-day-description">
          {messages.productDayForm.fields.description}
        </Label>
        <RichTextEditor
          value={state.description}
          onChange={field("description")}
          placeholder={messages.productDayForm.placeholders.description}
          editorClassName="max-h-[320px] overflow-y-auto"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            {messages.common.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {mode.kind === "create"
            ? messages.productDayForm.actions.addDay
            : messages.productDayForm.actions.saveDay}
        </Button>
      </div>
    </form>
  )
}
