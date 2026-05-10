"use client"

import {
  type CreateProductInput,
  type ProductRecord,
  useProductMutation,
} from "@voyantjs/products-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Textarea } from "@voyantjs/ui/components/textarea"
import { Loader2, X } from "lucide-react"
import * as React from "react"
import { useProductsUiMessagesOrDefault } from "../i18n/index.js"
import { ProductTypeCombobox } from "./product-type-combobox.js"

export type ProductFormMode = { kind: "create" } | { kind: "edit"; product: ProductRecord }

export interface ProductFormProps {
  mode: ProductFormMode
  onSuccess?: (product: ProductRecord) => void
  onCancel?: () => void
}

interface FormState {
  name: string
  description: string
  status: "draft" | "active" | "archived"
  bookingMode: "date" | "date_time" | "open" | "stay" | "transfer" | "itinerary" | "other"
  productTypeId: string
  sellCurrency: string
  sellAmount: string
  costAmount: string
  tags: string[]
}

function initialState(mode: ProductFormMode): FormState {
  if (mode.kind === "edit") {
    const product = mode.product
    return {
      name: product.name,
      description: product.description ?? "",
      status: product.status,
      bookingMode: product.bookingMode,
      productTypeId: product.productTypeId ?? "__none__",
      sellCurrency: product.sellCurrency,
      sellAmount: product.sellAmountCents != null ? String(product.sellAmountCents / 100) : "",
      costAmount: product.costAmountCents != null ? String(product.costAmountCents / 100) : "",
      tags: product.tags ?? [],
    }
  }

  return {
    name: "",
    description: "",
    status: "draft",
    bookingMode: "itinerary",
    productTypeId: "__none__",
    sellCurrency: "EUR",
    sellAmount: "",
    costAmount: "",
    tags: [],
  }
}

function toAmountCents(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

function toPayload(state: FormState): CreateProductInput {
  return {
    name: state.name.trim(),
    description: state.description.trim() || null,
    status: state.status,
    bookingMode: state.bookingMode,
    productTypeId: state.productTypeId === "__none__" ? null : state.productTypeId,
    sellCurrency: state.sellCurrency.trim().toUpperCase(),
    sellAmountCents: toAmountCents(state.sellAmount),
    costAmountCents: toAmountCents(state.costAmount),
    tags: state.tags,
  }
}

export function ProductForm({ mode, onSuccess, onCancel }: ProductFormProps) {
  const messages = useProductsUiMessagesOrDefault()
  const productMessages = messages.productForm
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [tagInput, setTagInput] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = useProductMutation()

  const isSubmitting = create.isPending || update.isPending
  const productStatuses = React.useMemo(
    () =>
      [
        { value: "draft", label: messages.common.productStatusLabels.draft },
        { value: "active", label: messages.common.productStatusLabels.active },
        { value: "archived", label: messages.common.productStatusLabels.archived },
      ] as const,
    [messages],
  )
  const bookingModes = React.useMemo(
    () =>
      [
        { value: "date", label: messages.common.productBookingModeLabels.date },
        { value: "date_time", label: messages.common.productBookingModeLabels.date_time },
        { value: "open", label: messages.common.productBookingModeLabels.open },
        { value: "stay", label: messages.common.productBookingModeLabels.stay },
        { value: "transfer", label: messages.common.productBookingModeLabels.transfer },
        { value: "itinerary", label: messages.common.productBookingModeLabels.itinerary },
        { value: "other", label: messages.common.productBookingModeLabels.other },
      ] as const,
    [messages],
  )

  const field =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }))
    }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!state.name.trim()) {
      setError(productMessages.validation.nameRequired)
      return
    }

    if (state.sellCurrency.trim().length !== 3) {
      setError(productMessages.validation.sellCurrencyInvalid)
      return
    }

    const payload = toPayload(state)

    try {
      const product =
        mode.kind === "create"
          ? await create.mutateAsync(payload)
          : await update.mutateAsync({ id: mode.product.id, input: payload })
      onSuccess?.(product)
    } catch (err) {
      setError(err instanceof Error ? err.message : productMessages.validation.saveFailed)
    }
  }

  return (
    <form data-slot="product-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-name">{productMessages.fields.name}</Label>
          <Input
            id="product-name"
            required
            autoFocus
            value={state.name}
            onChange={(event) => field("name")(event.target.value)}
            placeholder={productMessages.placeholders.name}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-description">{productMessages.fields.description}</Label>
          <Textarea
            id="product-description"
            value={state.description}
            onChange={(event) => field("description")(event.target.value)}
            placeholder={productMessages.placeholders.description}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{productMessages.fields.tags}</Label>
          <div className="flex flex-wrap gap-1.5">
            {state.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                {tag}
                <button
                  type="button"
                  className="ml-0.5 rounded-full hover:text-destructive"
                  onClick={() => field("tags")(state.tags.filter((value) => value !== tag))}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            ))}
          </div>
          <Input
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault()
                const value = tagInput.trim().replace(/,+$/, "")
                if (value && !state.tags.includes(value)) {
                  field("tags")([...state.tags, value])
                }
                setTagInput("")
              }
            }}
            placeholder={productMessages.placeholders.tagInput}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{productMessages.fields.status}</Label>
            <Select
              value={state.status}
              onValueChange={(value) => value && field("status")(value as FormState["status"])}
              items={productStatuses}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {productStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{productMessages.fields.bookingMode}</Label>
            <Select
              items={bookingModes}
              value={state.bookingMode}
              onValueChange={(value) =>
                value && field("bookingMode")(value as FormState["bookingMode"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bookingModes.map((modeOption) => (
                  <SelectItem key={modeOption.value} value={modeOption.value}>
                    {modeOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{productMessages.fields.productType}</Label>
            <ProductTypeCombobox
              value={state.productTypeId === "__none__" ? null : state.productTypeId}
              onChange={(value) => field("productTypeId")(value ?? "__none__")}
              placeholder={productMessages.placeholders.productTypeSearch}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{productMessages.fields.sellCurrency}</Label>
            <CurrencyCombobox
              value={state.sellCurrency}
              onChange={(value) => field("sellCurrency")(value ?? "")}
              placeholder={productMessages.placeholders.currencySearch}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-sell-amount">{productMessages.fields.sellAmount}</Label>
            <Input
              id="product-sell-amount"
              type="number"
              min="0"
              step="0.01"
              value={state.sellAmount}
              onChange={(event) => field("sellAmount")(event.target.value)}
              placeholder={productMessages.placeholders.amount}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-cost-amount">{productMessages.fields.costAmount}</Label>
            <Input
              id="product-cost-amount"
              type="number"
              min="0"
              step="0.01"
              value={state.costAmount}
              onChange={(event) => field("costAmount")(event.target.value)}
              placeholder={productMessages.placeholders.amount}
            />
          </div>
        </div>
      </div>

      {error ? (
        <p data-slot="product-form-error" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            {productMessages.actions.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              {productMessages.actions.saving}
            </>
          ) : mode.kind === "create" ? (
            productMessages.actions.create
          ) : (
            productMessages.actions.saveChanges
          )}
        </Button>
      </div>
    </form>
  )
}
