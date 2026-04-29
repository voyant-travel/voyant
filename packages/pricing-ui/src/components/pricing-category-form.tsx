"use client"

import {
  type CreatePricingCategoryInput,
  type PricingCategoryRecord,
  usePricingCategoryMutation,
} from "@voyantjs/pricing-react"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Switch } from "@voyantjs/ui/components/switch"
import { Loader2 } from "lucide-react"
import * as React from "react"
import type { PricingCategoryType } from "../i18n/messages"
import { usePricingUiMessagesOrDefault } from "../i18n/provider"

type Mode = { kind: "create" } | { kind: "edit"; category: PricingCategoryRecord }

export interface PricingCategoryFormProps {
  mode: Mode
  onSuccess?: (category: PricingCategoryRecord) => void
  onCancel?: () => void
}

interface FormState {
  name: string
  code: string
  categoryType:
    | "adult"
    | "child"
    | "infant"
    | "senior"
    | "group"
    | "room"
    | "vehicle"
    | "service"
    | "other"
  seatOccupancy: string
  isAgeQualified: boolean
  minAge: string
  maxAge: string
  active: boolean
  sortOrder: string
}

const CATEGORY_TYPES = [
  { value: "adult" },
  { value: "child" },
  { value: "infant" },
  { value: "senior" },
  { value: "group" },
  { value: "room" },
  { value: "vehicle" },
  { value: "service" },
  { value: "other" },
] as const

function initialState(mode: Mode): FormState {
  if (mode.kind === "edit") {
    const category = mode.category
    return {
      name: category.name,
      code: category.code ?? "",
      categoryType: category.categoryType,
      seatOccupancy: String(category.seatOccupancy),
      isAgeQualified: category.isAgeQualified,
      minAge: category.minAge != null ? String(category.minAge) : "",
      maxAge: category.maxAge != null ? String(category.maxAge) : "",
      active: category.active,
      sortOrder: String(category.sortOrder),
    }
  }

  return {
    name: "",
    code: "",
    categoryType: "adult",
    seatOccupancy: "1",
    isAgeQualified: false,
    minAge: "",
    maxAge: "",
    active: true,
    sortOrder: "0",
  }
}

function toInteger(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function toPayload(state: FormState): CreatePricingCategoryInput {
  return {
    name: state.name.trim(),
    code: state.code.trim() || null,
    categoryType: state.categoryType,
    seatOccupancy: toInteger(state.seatOccupancy) ?? 0,
    isAgeQualified: state.isAgeQualified,
    minAge: state.isAgeQualified ? toInteger(state.minAge) : null,
    maxAge: state.isAgeQualified ? toInteger(state.maxAge) : null,
    active: state.active,
    sortOrder: toInteger(state.sortOrder) ?? 0,
  }
}

export function PricingCategoryForm({ mode, onSuccess, onCancel }: PricingCategoryFormProps) {
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = usePricingCategoryMutation()
  const messages = usePricingUiMessagesOrDefault()

  React.useEffect(() => {
    setState(initialState(mode))
    setError(null)
  }, [mode])

  const isSubmitting = create.isPending || update.isPending

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!state.name.trim()) {
      setError(messages.pricingCategoryForm.validation.nameRequired)
      return
    }

    try {
      const category =
        mode.kind === "create"
          ? await create.mutateAsync(toPayload(state))
          : await update.mutateAsync({ id: mode.category.id, input: toPayload(state) })
      onSuccess?.(category)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : messages.pricingCategoryForm.validation.saveFailed,
      )
    }
  }

  return (
    <form data-slot="pricing-category-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pricing-category-name">{messages.pricingCategoryForm.fields.name}</Label>
          <Input
            id="pricing-category-name"
            required
            autoFocus
            value={state.name}
            onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
            placeholder={messages.pricingCategoryForm.placeholders.name}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pricing-category-code">{messages.pricingCategoryForm.fields.code}</Label>
          <Input
            id="pricing-category-code"
            value={state.code}
            onChange={(event) => setState((prev) => ({ ...prev, code: event.target.value }))}
            placeholder={messages.pricingCategoryForm.placeholders.code}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>{messages.pricingCategoryForm.fields.type}</Label>
          <Select
            items={CATEGORY_TYPES.map((type) => ({
              label: messages.common.categoryTypeLabels[type.value as PricingCategoryType],
              value: type.value,
            }))}
            value={state.categoryType}
            onValueChange={(value) =>
              setState((prev) => ({
                ...prev,
                categoryType: value as FormState["categoryType"],
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {messages.common.categoryTypeLabels[type.value as PricingCategoryType]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pricing-category-seat-occupancy">
            {messages.pricingCategoryForm.fields.seatOccupancy}
          </Label>
          <Input
            id="pricing-category-seat-occupancy"
            type="number"
            min="0"
            value={state.seatOccupancy}
            onChange={(event) =>
              setState((prev) => ({ ...prev, seatOccupancy: event.target.value }))
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={state.isAgeQualified}
          onCheckedChange={(isAgeQualified) => setState((prev) => ({ ...prev, isAgeQualified }))}
        />
        <Label>{messages.pricingCategoryForm.fields.ageQualified}</Label>
      </div>

      {state.isAgeQualified ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pricing-category-min-age">
              {messages.pricingCategoryForm.fields.minAge}
            </Label>
            <Input
              id="pricing-category-min-age"
              type="number"
              min="0"
              value={state.minAge}
              onChange={(event) => setState((prev) => ({ ...prev, minAge: event.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pricing-category-max-age">
              {messages.pricingCategoryForm.fields.maxAge}
            </Label>
            <Input
              id="pricing-category-max-age"
              type="number"
              min="0"
              value={state.maxAge}
              onChange={(event) => setState((prev) => ({ ...prev, maxAge: event.target.value }))}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pricing-category-sort-order">
            {messages.pricingCategoryForm.fields.sortOrder}
          </Label>
          <Input
            id="pricing-category-sort-order"
            type="number"
            value={state.sortOrder}
            onChange={(event) => setState((prev) => ({ ...prev, sortOrder: event.target.value }))}
          />
        </div>

        <div className="flex items-center gap-2 pt-7">
          <Switch
            checked={state.active}
            onCheckedChange={(active) => setState((prev) => ({ ...prev, active }))}
          />
          <Label>{messages.pricingCategoryForm.fields.active}</Label>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {messages.common.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {mode.kind === "edit"
            ? messages.common.saveChanges
            : messages.pricingCategoryForm.actions.create}
        </Button>
      </div>
    </form>
  )
}
