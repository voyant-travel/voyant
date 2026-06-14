"use client"

import { Button } from "@voyant-travel/ui/components/button"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import { Input } from "@voyant-travel/ui/components/input"
import { Label } from "@voyant-travel/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components/select"
import { Switch } from "@voyant-travel/ui/components/switch"
import { Textarea } from "@voyant-travel/ui/components/textarea"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { useProductsUiMessagesOrDefault } from "../i18n/provider.js"
import {
  type CreateProductOptionInput,
  type ProductOptionRecord,
  useProductOptionMutation,
} from "../index.js"

type Mode =
  | { kind: "create"; productId: string; sortOrder?: number }
  | { kind: "edit"; option: ProductOptionRecord }

export interface ProductOptionFormProps {
  mode: Mode
  onSuccess?: (option: ProductOptionRecord) => void
  onCancel?: () => void
}

interface FormState {
  name: string
  code: string
  description: string
  status: "draft" | "active" | "archived"
  isDefault: boolean
  sortOrder: string
  availableFrom: string
  availableTo: string
}

const OPTION_STATUSES = [{ value: "draft" }, { value: "active" }, { value: "archived" }] as const

function initialState(mode: Mode): FormState {
  if (mode.kind === "edit") {
    return {
      name: mode.option.name,
      code: mode.option.code ?? "",
      description: mode.option.description ?? "",
      status: mode.option.status,
      isDefault: mode.option.isDefault,
      sortOrder: String(mode.option.sortOrder),
      availableFrom: mode.option.availableFrom ?? "",
      availableTo: mode.option.availableTo ?? "",
    }
  }

  return {
    name: "",
    code: "",
    description: "",
    status: "active",
    isDefault: false,
    sortOrder: String(mode.sortOrder ?? 0),
    availableFrom: "",
    availableTo: "",
  }
}

function toOptionalString(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function toPayload(state: FormState): Omit<CreateProductOptionInput, "productId"> {
  return {
    name: state.name.trim(),
    code: toOptionalString(state.code),
    description: toOptionalString(state.description),
    status: state.status,
    isDefault: state.isDefault,
    sortOrder: Number.parseInt(state.sortOrder || "0", 10) || 0,
    availableFrom: toOptionalString(state.availableFrom),
    availableTo: toOptionalString(state.availableTo),
  }
}

export function ProductOptionForm({ mode, onSuccess, onCancel }: ProductOptionFormProps) {
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = useProductOptionMutation()
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
      setError(messages.productOptionForm.validation.nameRequired)
      return
    }

    try {
      const option =
        mode.kind === "create"
          ? await create.mutateAsync({ productId: mode.productId, ...toPayload(state) })
          : await update.mutateAsync({ id: mode.option.id, input: toPayload(state) })
      onSuccess?.(option)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : messages.productOptionForm.validation.saveFailed,
      )
    }
  }

  return (
    <form data-slot="product-option-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-option-name">{messages.productOptionForm.fields.name}</Label>
          <Input
            id="product-option-name"
            required
            autoFocus
            value={state.name}
            onChange={(event) => field("name")(event.target.value)}
            placeholder={messages.productOptionForm.placeholders.name}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-option-code">{messages.productOptionForm.fields.code}</Label>
          <Input
            id="product-option-code"
            value={state.code}
            onChange={(event) => field("code")(event.target.value)}
            placeholder={messages.productOptionForm.placeholders.code}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-option-description">
          {messages.productOptionForm.fields.description}
        </Label>
        <Textarea
          id="product-option-description"
          value={state.description}
          onChange={(event) => field("description")(event.target.value)}
          placeholder={messages.productOptionForm.placeholders.description}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>{messages.productOptionForm.fields.status}</Label>
          <Select
            value={state.status}
            onValueChange={(value) => value && field("status")(value)}
            items={OPTION_STATUSES.map((status) => ({
              label: messages.common.optionStatusLabels[status.value],
              value: status.value,
            }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPTION_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {messages.common.optionStatusLabels[status.value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-option-sort-order">
            {messages.productOptionForm.fields.sortOrder}
          </Label>
          <Input
            id="product-option-sort-order"
            type="number"
            value={state.sortOrder}
            onChange={(event) => field("sortOrder")(event.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-option-available-from">
            {messages.productOptionForm.fields.availableFrom}
          </Label>
          <DatePicker
            value={state.availableFrom || null}
            onChange={(next) => field("availableFrom")(next ?? "")}
            placeholder={messages.productOptionForm.placeholders.availableFrom}
            className="w-full"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-option-available-to">
            {messages.productOptionForm.fields.availableTo}
          </Label>
          <DatePicker
            value={state.availableTo || null}
            onChange={(next) => field("availableTo")(next ?? "")}
            placeholder={messages.productOptionForm.placeholders.availableTo}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={state.isDefault}
          onCheckedChange={(checked) => field("isDefault")(checked)}
        />
        <Label htmlFor="product-option-default">
          {messages.productOptionForm.fields.defaultOption}
        </Label>
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
            ? messages.productOptionForm.actions.createOption
            : messages.common.saveChanges}
        </Button>
      </div>
    </form>
  )
}
