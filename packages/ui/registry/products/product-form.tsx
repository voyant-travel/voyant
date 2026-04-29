"use client"

import {
  type CreateProductInput,
  type ProductRecord,
  useProductMutation,
} from "@voyantjs/products-react"
import { currencies } from "@voyantjs/utils/currencies"
import { Loader2, X } from "lucide-react"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { useRegistryProductsMessagesOrDefault } from "./i18n/provider"
import { ProductTypeCombobox } from "./product-type-combobox"

type Mode = { kind: "create" } | { kind: "edit"; product: ProductRecord }

export interface ProductFormProps {
  mode: Mode
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

const PRODUCT_STATUSES = [{ value: "draft" }, { value: "active" }, { value: "archived" }] as const

const BOOKING_MODES = [
  { value: "date" },
  { value: "date_time" },
  { value: "open" },
  { value: "stay" },
  { value: "transfer" },
  { value: "itinerary" },
  { value: "other" },
] as const

const CURRENCY_OPTIONS = Object.values(currencies).map((currency) => ({
  value: currency.code,
  label: `${currency.code} — ${currency.name}`,
}))

function initialState(mode: Mode): FormState {
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
    sellCurrency: "EUR", // i18n-literal-ok ISO default currency
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
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [tagInput, setTagInput] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = useProductMutation()
  const messages = useRegistryProductsMessagesOrDefault()

  const isSubmitting = create.isPending || update.isPending

  const field =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }))
    }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!state.name.trim()) {
      setError(messages.productForm.validation.nameRequired)
      return
    }

    if (state.sellCurrency.trim().length !== 3) {
      setError(messages.productForm.validation.sellCurrencyInvalid)
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
      setError(err instanceof Error ? err.message : messages.productForm.validation.saveFailed)
    }
  }

  return (
    <form data-slot="product-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-name">{messages.productForm.fields.name}</Label>
          <Input
            id="product-name"
            required
            autoFocus
            value={state.name}
            onChange={(event) => field("name")(event.target.value)}
            placeholder={messages.productForm.placeholders.name}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-description">{messages.productForm.fields.description}</Label>
          <Textarea
            id="product-description"
            value={state.description}
            onChange={(event) => field("description")(event.target.value)}
            placeholder={messages.productForm.placeholders.description}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{messages.productForm.fields.tags}</Label>
          <div className="flex flex-wrap gap-1.5">
            {state.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                {tag}
                <button
                  type="button"
                  aria-label={messages.productForm.actions.removeTag}
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
            placeholder={messages.productForm.placeholders.tags}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{messages.productForm.fields.status}</Label>
            <Select
              value={state.status}
              onValueChange={(value) => value && field("status")(value)}
              items={PRODUCT_STATUSES.map((status) => ({
                label: messages.common.productStatusLabels[status.value],
                value: status.value,
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {messages.common.productStatusLabels[status.value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{messages.productForm.fields.bookingMode}</Label>
            <Select
              items={BOOKING_MODES.map((modeOption) => ({
                label: messages.productForm.bookingModeLabels[modeOption.value],
                value: modeOption.value,
              }))}
              value={state.bookingMode}
              onValueChange={(value) => value && field("bookingMode")(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_MODES.map((modeOption) => (
                  <SelectItem key={modeOption.value} value={modeOption.value}>
                    {messages.productForm.bookingModeLabels[modeOption.value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{messages.productForm.fields.productType}</Label>
            <ProductTypeCombobox
              value={state.productTypeId === "__none__" ? null : state.productTypeId}
              onChange={(value) => field("productTypeId")(value ?? "__none__")}
              placeholder={messages.productForm.placeholders.productType}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{messages.productForm.fields.sellCurrency}</Label>
            <Select
              items={CURRENCY_OPTIONS}
              value={state.sellCurrency}
              onValueChange={(value) => value && field("sellCurrency")(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((currencyOption) => (
                  <SelectItem key={currencyOption.value} value={currencyOption.value}>
                    {currencyOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-sell-amount">{messages.productForm.fields.sellAmount}</Label>
            <Input
              id="product-sell-amount"
              type="number"
              min="0"
              step="0.01"
              value={state.sellAmount}
              onChange={(event) => field("sellAmount")(event.target.value)}
              placeholder={messages.productForm.placeholders.sellAmount}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-cost-amount">{messages.productForm.fields.costAmount}</Label>
            <Input
              id="product-cost-amount"
              type="number"
              min="0"
              step="0.01"
              value={state.costAmount}
              onChange={(event) => field("costAmount")(event.target.value)}
              placeholder={messages.productForm.placeholders.costAmount}
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
            {messages.common.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              {messages.productForm.actions.saving}
            </>
          ) : mode.kind === "create" ? (
            messages.productForm.actions.createProduct
          ) : (
            messages.common.saveChanges
          )}
        </Button>
      </div>
    </form>
  )
}
