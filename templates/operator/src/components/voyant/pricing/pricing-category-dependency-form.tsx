"use client"

import {
  type CreatePricingCategoryDependencyInput,
  type PricingCategoryDependencyRecord,
  usePricingCategoryDependencyMutation,
} from "@voyantjs/commerce-react/pricing"
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
import { useAdminMessages } from "@/lib/admin-i18n"
import { PricingCategoryCombobox } from "./pricing-category-combobox"

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
  const messages = useAdminMessages()
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = usePricingCategoryDependencyMutation()
  const dependencyTypes = React.useMemo(
    () =>
      [
        { value: "requires", label: messages.pricing.dependencies.typeRequires },
        { value: "limits_per_master", label: messages.pricing.dependencies.typeLimitsPerMaster },
        { value: "limits_sum", label: messages.pricing.dependencies.typeLimitsSum },
        { value: "excludes", label: messages.pricing.dependencies.typeExcludes },
      ] as const,
    [messages],
  )

  React.useEffect(() => {
    setState(initialState(mode))
    setError(null)
  }, [mode])

  const isSubmitting = create.isPending || update.isPending

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!state.masterPricingCategoryId || !state.pricingCategoryId) {
      setError(messages.pricing.dependencies.validationCategoriesRequired)
      return
    }

    try {
      const dependency =
        mode.kind === "create"
          ? await create.mutateAsync(toPayload(state))
          : await update.mutateAsync({ id: mode.dependency.id, input: toPayload(state) })
      onSuccess?.(dependency)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.pricing.dependencies.saveFailed)
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
          <Label>{messages.pricing.dependencies.masterCategoryLabel}</Label>
          <PricingCategoryCombobox
            value={state.masterPricingCategoryId}
            onChange={(value) =>
              setState((prev) => ({ ...prev, masterPricingCategoryId: value ?? "" }))
            }
            placeholder={messages.pricing.dependencies.categorySearchPlaceholder}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{messages.pricing.dependencies.dependentCategoryLabel}</Label>
          <PricingCategoryCombobox
            value={state.pricingCategoryId}
            onChange={(value) => setState((prev) => ({ ...prev, pricingCategoryId: value ?? "" }))}
            placeholder={messages.pricing.dependencies.categorySearchPlaceholder}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{messages.pricing.dependencies.dependencyTypeLabel}</Label>
        <Select
          items={dependencyTypes}
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
            {dependencyTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pricing-category-dependency-max-per-master">
            {messages.pricing.dependencies.maxPerMasterLabel}
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
            {messages.pricing.dependencies.maxDependentSumLabel}
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
        <Label>{messages.pricing.dependencies.activeLabel}</Label>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pricing-category-dependency-notes">
          {messages.pricing.dependencies.notesLabel}
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
            {messages.pricing.dependencies.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {mode.kind === "edit"
            ? messages.pricing.dependencies.saveChanges
            : messages.pricing.dependencies.createDependency}
        </Button>
      </div>
    </form>
  )
}
