"use client"

import {
  type CreatePricingCategoryDependencyInput,
  type PricingCategoryDependencyRecord,
  usePricingCategoryDependencyMutation,
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
import { Textarea } from "@voyantjs/ui/components/textarea"
import { Loader2 } from "lucide-react"
import * as React from "react"
import type { PricingDependencyType } from "../i18n/messages.js"
import { usePricingUiMessagesOrDefault } from "../i18n/provider.js"
import { PricingCategoryCombobox } from "./pricing-category-combobox.js"

type Mode = { kind: "create" } | { kind: "edit"; dependency: PricingCategoryDependencyRecord }

export interface PricingCategoryDependencyFormProps {
  mode: Mode
  onSuccess?: (dependency: PricingCategoryDependencyRecord) => void
  onCancel?: () => void
}

interface FormState {
  pricingCategoryId: string
  masterPricingCategoryId: string
  dependencyType: "requires" | "limits_per_master" | "limits_sum" | "excludes"
  maxPerMaster: string
  maxDependentSum: string
  active: boolean
  notes: string
}

const DEPENDENCY_TYPES = [
  { value: "requires" },
  { value: "limits_per_master" },
  { value: "limits_sum" },
  { value: "excludes" },
] as const

function initialState(mode: Mode): FormState {
  if (mode.kind === "edit") {
    const dependency = mode.dependency
    return {
      pricingCategoryId: dependency.pricingCategoryId,
      masterPricingCategoryId: dependency.masterPricingCategoryId,
      dependencyType: dependency.dependencyType,
      maxPerMaster: dependency.maxPerMaster != null ? String(dependency.maxPerMaster) : "",
      maxDependentSum: dependency.maxDependentSum != null ? String(dependency.maxDependentSum) : "",
      active: dependency.active,
      notes: dependency.notes ?? "",
    }
  }

  return {
    pricingCategoryId: "",
    masterPricingCategoryId: "",
    dependencyType: "requires",
    maxPerMaster: "",
    maxDependentSum: "",
    active: true,
    notes: "",
  }
}

function toInteger(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function toPayload(state: FormState): CreatePricingCategoryDependencyInput {
  return {
    pricingCategoryId: state.pricingCategoryId,
    masterPricingCategoryId: state.masterPricingCategoryId,
    dependencyType: state.dependencyType,
    maxPerMaster: toInteger(state.maxPerMaster),
    maxDependentSum: toInteger(state.maxDependentSum),
    active: state.active,
    notes: state.notes.trim() || null,
  }
}

export function PricingCategoryDependencyForm({
  mode,
  onSuccess,
  onCancel,
}: PricingCategoryDependencyFormProps) {
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = usePricingCategoryDependencyMutation()
  const messages = usePricingUiMessagesOrDefault()

  React.useEffect(() => {
    setState(initialState(mode))
    setError(null)
  }, [mode])

  const isSubmitting = create.isPending || update.isPending

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!state.masterPricingCategoryId || !state.pricingCategoryId) {
      setError(messages.pricingCategoryDependencyForm.validation.categoriesRequired)
      return
    }

    try {
      const dependency =
        mode.kind === "create"
          ? await create.mutateAsync(toPayload(state))
          : await update.mutateAsync({ id: mode.dependency.id, input: toPayload(state) })
      onSuccess?.(dependency)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : messages.pricingCategoryDependencyForm.validation.saveFailed,
      )
    }
  }

  return (
    <form
      data-slot="pricing-category-dependency-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>{messages.pricingCategoryDependencyForm.fields.masterCategory}</Label>
          <PricingCategoryCombobox
            value={state.masterPricingCategoryId}
            onChange={(value) =>
              setState((prev) => ({ ...prev, masterPricingCategoryId: value ?? "" }))
            }
            placeholder={messages.pricingCategoryDependencyForm.placeholders.categorySearch}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{messages.pricingCategoryDependencyForm.fields.dependentCategory}</Label>
          <PricingCategoryCombobox
            value={state.pricingCategoryId}
            onChange={(value) => setState((prev) => ({ ...prev, pricingCategoryId: value ?? "" }))}
            placeholder={messages.pricingCategoryDependencyForm.placeholders.categorySearch}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{messages.pricingCategoryDependencyForm.fields.dependencyType}</Label>
        <Select
          items={DEPENDENCY_TYPES.map((type) => ({
            label: messages.common.dependencyTypeLabels[type.value as PricingDependencyType],
            value: type.value,
          }))}
          value={state.dependencyType}
          onValueChange={(value) =>
            setState((prev) => ({
              ...prev,
              dependencyType: value as FormState["dependencyType"],
            }))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEPENDENCY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {messages.common.dependencyTypeLabels[type.value as PricingDependencyType]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pricing-category-dependency-max-per-master">
            {messages.pricingCategoryDependencyForm.fields.maxPerMaster}
          </Label>
          <Input
            id="pricing-category-dependency-max-per-master"
            type="number"
            min="0"
            value={state.maxPerMaster}
            onChange={(event) =>
              setState((prev) => ({ ...prev, maxPerMaster: event.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pricing-category-dependency-max-dependent-sum">
            {messages.pricingCategoryDependencyForm.fields.maxDependentSum}
          </Label>
          <Input
            id="pricing-category-dependency-max-dependent-sum"
            type="number"
            min="0"
            value={state.maxDependentSum}
            onChange={(event) =>
              setState((prev) => ({ ...prev, maxDependentSum: event.target.value }))
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={state.active}
          onCheckedChange={(active) => setState((prev) => ({ ...prev, active }))}
        />
        <Label>{messages.pricingCategoryDependencyForm.fields.active}</Label>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pricing-category-dependency-notes">
          {messages.pricingCategoryDependencyForm.fields.notes}
        </Label>
        <Textarea
          id="pricing-category-dependency-notes"
          value={state.notes}
          onChange={(event) => setState((prev) => ({ ...prev, notes: event.target.value }))}
        />
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
            : messages.pricingCategoryDependencyForm.actions.create}
        </Button>
      </div>
    </form>
  )
}
