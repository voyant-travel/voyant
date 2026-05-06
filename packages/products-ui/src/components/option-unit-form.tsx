"use client"

import {
  type CreateOptionUnitInput,
  type OptionUnitRecord,
  useOptionUnitMutation,
} from "@voyantjs/products-react"
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
import { Textarea } from "@voyantjs/ui/components/textarea"
import { Loader2 } from "lucide-react"
import * as React from "react"

import { useProductsUiMessagesOrDefault } from "../i18n/provider.js"

type Mode =
  | { kind: "create"; optionId: string; sortOrder?: number }
  | { kind: "edit"; unit: OptionUnitRecord }

export interface OptionUnitFormProps {
  mode: Mode
  onSuccess?: (unit: OptionUnitRecord) => void
  onCancel?: () => void
}

interface FormState {
  name: string
  code: string
  description: string
  unitType: "person" | "group" | "room" | "vehicle" | "service" | "other"
  minQuantity: string
  maxQuantity: string
  minAge: string
  maxAge: string
  occupancyMin: string
  occupancyMax: string
  isRequired: boolean
  isHidden: boolean
  sortOrder: string
}

const UNIT_TYPES = [
  { value: "person" },
  { value: "group" },
  { value: "room" },
  { value: "vehicle" },
  { value: "service" },
  { value: "other" },
] as const

function initialState(mode: Mode): FormState {
  if (mode.kind === "edit") {
    return {
      name: mode.unit.name,
      code: mode.unit.code ?? "",
      description: mode.unit.description ?? "",
      unitType: mode.unit.unitType,
      minQuantity: mode.unit.minQuantity != null ? String(mode.unit.minQuantity) : "",
      maxQuantity: mode.unit.maxQuantity != null ? String(mode.unit.maxQuantity) : "",
      minAge: mode.unit.minAge != null ? String(mode.unit.minAge) : "",
      maxAge: mode.unit.maxAge != null ? String(mode.unit.maxAge) : "",
      occupancyMin: mode.unit.occupancyMin != null ? String(mode.unit.occupancyMin) : "",
      occupancyMax: mode.unit.occupancyMax != null ? String(mode.unit.occupancyMax) : "",
      isRequired: mode.unit.isRequired,
      isHidden: mode.unit.isHidden,
      sortOrder: String(mode.unit.sortOrder),
    }
  }

  return {
    name: "",
    code: "",
    description: "",
    unitType: "person",
    minQuantity: "",
    maxQuantity: "",
    minAge: "",
    maxAge: "",
    occupancyMin: "",
    occupancyMax: "",
    isRequired: false,
    isHidden: false,
    sortOrder: String(mode.sortOrder ?? 0),
  }
}

function toOptionalString(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function toPayload(state: FormState): Omit<CreateOptionUnitInput, "optionId"> {
  return {
    name: state.name.trim(),
    code: toOptionalString(state.code),
    description: toOptionalString(state.description),
    unitType: state.unitType,
    minQuantity: toOptionalNumber(state.minQuantity),
    maxQuantity: toOptionalNumber(state.maxQuantity),
    minAge: toOptionalNumber(state.minAge),
    maxAge: toOptionalNumber(state.maxAge),
    occupancyMin: toOptionalNumber(state.occupancyMin),
    occupancyMax: toOptionalNumber(state.occupancyMax),
    isRequired: state.isRequired,
    isHidden: state.isHidden,
    sortOrder: Number.parseInt(state.sortOrder || "0", 10) || 0,
  }
}

export function OptionUnitForm({ mode, onSuccess, onCancel }: OptionUnitFormProps) {
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = useOptionUnitMutation()
  const messages = useProductsUiMessagesOrDefault()

  React.useEffect(() => {
    setState(initialState(mode))
    setError(null)
  }, [mode])

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
      setError(messages.optionUnitForm.validation.nameRequired)
      return
    }

    try {
      const unit =
        mode.kind === "create"
          ? await create.mutateAsync({ optionId: mode.optionId, ...toPayload(state) })
          : await update.mutateAsync({ id: mode.unit.id, input: toPayload(state) })
      onSuccess?.(unit)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.optionUnitForm.validation.saveFailed)
    }
  }

  const showAgeRange = state.unitType === "person"
  const showOccupancy =
    state.unitType === "group" || state.unitType === "room" || state.unitType === "vehicle"

  return (
    <form data-slot="option-unit-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="option-unit-name">{messages.optionUnitForm.fields.name}</Label>
          <Input
            id="option-unit-name"
            required
            autoFocus
            value={state.name}
            onChange={(event) => field("name")(event.target.value)}
            placeholder={messages.optionUnitForm.placeholders.name}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="option-unit-code">{messages.optionUnitForm.fields.code}</Label>
          <Input
            id="option-unit-code"
            value={state.code}
            onChange={(event) => field("code")(event.target.value)}
            placeholder={messages.optionUnitForm.placeholders.code}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>{messages.optionUnitForm.fields.unitType}</Label>
          <Select
            items={UNIT_TYPES.map((type) => ({
              label: messages.common.optionUnitTypeLabels[type.value],
              value: type.value,
            }))}
            value={state.unitType}
            onValueChange={(value) => value && field("unitType")(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {messages.common.optionUnitTypeLabels[type.value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="option-unit-sort-order">{messages.optionUnitForm.fields.sortOrder}</Label>
          <Input
            id="option-unit-sort-order"
            type="number"
            value={state.sortOrder}
            onChange={(event) => field("sortOrder")(event.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="option-unit-min-quantity">
            {messages.optionUnitForm.fields.minQuantity}
          </Label>
          <Input
            id="option-unit-min-quantity"
            type="number"
            min="0"
            value={state.minQuantity}
            onChange={(event) => field("minQuantity")(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="option-unit-max-quantity">
            {messages.optionUnitForm.fields.maxQuantity}
          </Label>
          <Input
            id="option-unit-max-quantity"
            type="number"
            min="0"
            value={state.maxQuantity}
            onChange={(event) => field("maxQuantity")(event.target.value)}
          />
        </div>
      </div>

      {showAgeRange ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="option-unit-min-age">{messages.optionUnitForm.fields.minAge}</Label>
            <Input
              id="option-unit-min-age"
              type="number"
              min="0"
              value={state.minAge}
              onChange={(event) => field("minAge")(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="option-unit-max-age">{messages.optionUnitForm.fields.maxAge}</Label>
            <Input
              id="option-unit-max-age"
              type="number"
              min="0"
              value={state.maxAge}
              onChange={(event) => field("maxAge")(event.target.value)}
            />
          </div>
        </div>
      ) : null}

      {showOccupancy ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="option-unit-occupancy-min">
              {messages.optionUnitForm.fields.occupancyMin}
            </Label>
            <Input
              id="option-unit-occupancy-min"
              type="number"
              min="0"
              value={state.occupancyMin}
              onChange={(event) => field("occupancyMin")(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="option-unit-occupancy-max">
              {messages.optionUnitForm.fields.occupancyMax}
            </Label>
            <Input
              id="option-unit-occupancy-max"
              type="number"
              min="0"
              value={state.occupancyMax}
              onChange={(event) => field("occupancyMax")(event.target.value)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="option-unit-description">
          {messages.optionUnitForm.fields.description}
        </Label>
        <Textarea
          id="option-unit-description"
          value={state.description}
          onChange={(event) => field("description")(event.target.value)}
          placeholder={messages.optionUnitForm.placeholders.description}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={state.isRequired}
            onCheckedChange={(checked) => field("isRequired")(checked)}
          />
          <Label>{messages.optionUnitForm.fields.required}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={state.isHidden}
            onCheckedChange={(checked) => field("isHidden")(checked)}
          />
          <Label>{messages.optionUnitForm.fields.hidden}</Label>
        </div>
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
            ? messages.optionUnitForm.actions.createUnit
            : messages.common.saveChanges}
        </Button>
      </div>
    </form>
  )
}
