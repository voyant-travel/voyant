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
import { ProductFacilityCombobox } from "./product-facility-combobox.js"
import { ProductTaxClassCombobox } from "./product-tax-class-combobox.js"
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
  capacityMode: ProductRecord["capacityMode"]
  visibility: ProductRecord["visibility"]
  timezone: string
  facilityId: string
  productTypeId: string
  taxClassId: string
  sellCurrency: string
  sellAmount: string
  costAmount: string
  pax: string
  reservationTimeoutMinutes: string
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
      capacityMode: product.capacityMode,
      visibility: product.visibility,
      timezone: product.timezone ?? "",
      facilityId: product.facilityId ?? "__none__",
      productTypeId: product.productTypeId ?? "__none__",
      taxClassId: product.taxClassId ?? "__none__",
      sellCurrency: product.sellCurrency,
      sellAmount: product.sellAmountCents != null ? String(product.sellAmountCents / 100) : "",
      costAmount: product.costAmountCents != null ? String(product.costAmountCents / 100) : "",
      pax: product.pax != null ? String(product.pax) : "",
      reservationTimeoutMinutes:
        product.reservationTimeoutMinutes != null ? String(product.reservationTimeoutMinutes) : "",
      tags: product.tags ?? [],
    }
  }

  return {
    name: "",
    description: "",
    status: "draft",
    bookingMode: "itinerary",
    capacityMode: "limited",
    visibility: "private",
    timezone: "",
    facilityId: "__none__",
    productTypeId: "__none__",
    taxClassId: "__none__",
    sellCurrency: "EUR", // i18n-literal-ok ISO default currency
    sellAmount: "",
    costAmount: "",
    pax: "",
    reservationTimeoutMinutes: "",
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

function toIntegerOrNull(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

function toPositiveIntegerOrNull(value: string): number | null {
  const parsed = toIntegerOrNull(value)
  return parsed == null || parsed < 1 ? null : parsed
}

function toPayload(state: FormState): CreateProductInput {
  return {
    name: state.name.trim(),
    description: state.description.trim() || null,
    status: state.status,
    bookingMode: state.bookingMode,
    capacityMode: state.capacityMode,
    visibility: state.visibility,
    timezone: state.timezone.trim() || null,
    facilityId: state.facilityId === "__none__" ? null : state.facilityId,
    productTypeId: state.productTypeId === "__none__" ? null : state.productTypeId,
    taxClassId: state.taxClassId === "__none__" ? null : state.taxClassId,
    sellCurrency: state.sellCurrency.trim().toUpperCase(),
    sellAmountCents: toAmountCents(state.sellAmount),
    costAmountCents: toAmountCents(state.costAmount),
    pax: toPositiveIntegerOrNull(state.pax),
    reservationTimeoutMinutes: toIntegerOrNull(state.reservationTimeoutMinutes),
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
  const capacityModes = React.useMemo(
    () =>
      [
        { value: "free_sale", label: messages.common.productCapacityModeLabels.free_sale },
        { value: "limited", label: messages.common.productCapacityModeLabels.limited },
        { value: "on_request", label: messages.common.productCapacityModeLabels.on_request },
      ] as const,
    [messages],
  )
  const visibilityOptions = React.useMemo(
    () =>
      [
        { value: "public", label: messages.common.productVisibilityLabels.public },
        { value: "private", label: messages.common.productVisibilityLabels.private },
        { value: "hidden", label: messages.common.productVisibilityLabels.hidden },
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

    if (state.pax.trim() && toPositiveIntegerOrNull(state.pax) == null) {
      setError(productMessages.validation.paxInvalid)
      return
    }

    if (
      state.reservationTimeoutMinutes.trim() &&
      toIntegerOrNull(state.reservationTimeoutMinutes) == null
    ) {
      setError(productMessages.validation.reservationTimeoutInvalid)
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
    <form
      data-slot="product-form"
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1"
    >
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
            <Label>{productMessages.fields.facility}</Label>
            <ProductFacilityCombobox
              value={state.facilityId === "__none__" ? null : state.facilityId}
              onChange={(value) => field("facilityId")(value ?? "__none__")}
              placeholder={productMessages.placeholders.facilitySearch}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{productMessages.fields.taxClass}</Label>
            <ProductTaxClassCombobox
              value={state.taxClassId === "__none__" ? null : state.taxClassId}
              onChange={(value) => field("taxClassId")(value ?? "__none__")}
              placeholder={productMessages.placeholders.taxClassSearch}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{productMessages.fields.visibility}</Label>
            <Select
              items={visibilityOptions}
              value={state.visibility}
              onValueChange={(value) =>
                value && field("visibility")(value as FormState["visibility"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visibilityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{productMessages.fields.capacityMode}</Label>
            <Select
              items={capacityModes}
              value={state.capacityMode}
              onValueChange={(value) =>
                value && field("capacityMode")(value as FormState["capacityMode"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {capacityModes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-timezone">{productMessages.fields.timezone}</Label>
            <Input
              id="product-timezone"
              value={state.timezone}
              onChange={(event) => field("timezone")(event.target.value)}
              placeholder={productMessages.placeholders.timezone}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-pax">{productMessages.fields.pax}</Label>
            <Input
              id="product-pax"
              type="number"
              min="1"
              step="1"
              value={state.pax}
              onChange={(event) => field("pax")(event.target.value)}
              placeholder={productMessages.placeholders.pax}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-reservation-timeout">
              {productMessages.fields.reservationTimeout}
            </Label>
            <Input
              id="product-reservation-timeout"
              type="number"
              min="0"
              step="1"
              value={state.reservationTimeoutMinutes}
              onChange={(event) => field("reservationTimeoutMinutes")(event.target.value)}
              placeholder={productMessages.placeholders.reservationTimeout}
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
