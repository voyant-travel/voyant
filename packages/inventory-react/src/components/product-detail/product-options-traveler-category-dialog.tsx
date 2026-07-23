import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@voyant-travel/ui/components"
import { Checkbox } from "@voyant-travel/ui/components/checkbox"
import { useEffect, useState } from "react"
import { type PricingCategoryRecord, usePricingCategoryMutation } from "./commerce-client.js"
import { useProductDetailMessages } from "./host.js"
import type { OptionUnitData } from "./product-unit-dialog.js"

type TravelerCategoryType = CreateTravelerCategoryState["categoryType"]

type CreateTravelerCategoryState = {
  name: string
  code: string
  categoryType: PricingCategoryRecord["categoryType"]
  minAge: string
  maxAge: string
  condition: string
  allowedUnitIds: string[]
}

function initialTravelerCategoryState(): CreateTravelerCategoryState {
  return {
    name: "",
    code: "",
    categoryType: "child",
    minAge: "",
    maxAge: "",
    condition: "",
    allowedUnitIds: [],
  }
}

function stateFromCategory(category: PricingCategoryRecord): CreateTravelerCategoryState {
  const metadata = category.metadata ?? {}
  const allowedUnitIds = Array.isArray(metadata.allowedUnitIds)
    ? metadata.allowedUnitIds.filter((id): id is string => typeof id === "string")
    : []
  return {
    name: category.name,
    code: category.code ?? "",
    categoryType: category.categoryType,
    minAge: category.minAge != null ? String(category.minAge) : "",
    maxAge: category.maxAge != null ? String(category.maxAge) : "",
    condition: typeof metadata.condition === "string" ? metadata.condition : "",
    allowedUnitIds,
  }
}

function parseOptionalInteger(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

export function TravelerCategoryDialog({
  open,
  onOpenChange,
  productId,
  units,
  nextSortOrder,
  category,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  units: OptionUnitData[]
  nextSortOrder: number
  category?: PricingCategoryRecord
  onSuccess: () => void
}) {
  const messages = useProductDetailMessages()
  const priceRuleMessages = messages.products.operations.priceRules
  const pricingCategoryMessages = messages.pricing.categories
  const { create, update } = usePricingCategoryMutation()
  const isEditing = !!category
  const [state, setState] = useState<CreateTravelerCategoryState>(() =>
    initialTravelerCategoryState(),
  )
  const [error, setError] = useState<string | null>(null)
  const travelerCategoryTypes: Array<{ value: TravelerCategoryType; label: string }> = [
    { value: "adult", label: pricingCategoryMessages.typeAdult },
    { value: "child", label: pricingCategoryMessages.typeChild },
    { value: "infant", label: pricingCategoryMessages.typeInfant },
    { value: "senior", label: pricingCategoryMessages.typeSenior },
    { value: "group", label: pricingCategoryMessages.typeGroup },
    { value: "other", label: pricingCategoryMessages.typeOther },
  ]

  useEffect(() => {
    if (open) {
      setState(category ? stateFromCategory(category) : initialTravelerCategoryState())
      setError(null)
    }
  }, [open, category])

  const toggleUnit = (unitId: string, checked: boolean) => {
    setState((prev) => ({
      ...prev,
      allowedUnitIds: checked
        ? [...prev.allowedUnitIds, unitId]
        : prev.allowedUnitIds.filter((id) => id !== unitId),
    }))
  }

  const save = async () => {
    const name = state.name.trim()
    if (!name) {
      setError(priceRuleMessages.travelerCategoryNameRequired)
      return
    }

    const selectedUnits = units.filter((unit) => state.allowedUnitIds.includes(unit.id))
    const minAge = parseOptionalInteger(state.minAge)
    const maxAge = parseOptionalInteger(state.maxAge)
    const condition = state.condition.trim()
    const metadata: Record<string, unknown> = {}
    if (condition) metadata.condition = condition
    if (selectedUnits.length > 0) {
      metadata.allowedUnitIds = selectedUnits.map((unit) => unit.id)
      metadata.allowedUnitCodes = selectedUnits.map((unit) => unit.code).filter(Boolean)
      metadata.allowedUnitNames = selectedUnits.map((unit) => unit.name)
    }

    const payload = {
      // On edit, preserve the category's existing scope — re-stamping a shared
      // (global) category with this product's id would silently steal it from
      // every other product that relies on it. Only a freshly created category
      // is scoped to the current product.
      productId: category ? (category.productId ?? null) : productId,
      optionId: category ? (category.optionId ?? null) : null,
      unitId: null,
      name,
      code: state.code.trim() || null,
      categoryType: state.categoryType,
      seatOccupancy: 1,
      isAgeQualified: minAge != null || maxAge != null,
      minAge,
      maxAge,
      internalUseOnly: false,
      active: true,
      sortOrder: category?.sortOrder ?? nextSortOrder,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    }

    try {
      if (category) {
        await update.mutateAsync({ id: category.id, input: payload })
      } else {
        await create.mutateAsync(payload)
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : priceRuleMessages.travelerCategorySaveFailed)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? priceRuleMessages.travelerCategoryEditTitle
              : priceRuleMessages.travelerCategoryDialogTitle}
          </SheetTitle>
          <SheetDescription>{priceRuleMessages.travelerCategoryDialogDescription}</SheetDescription>
        </SheetHeader>
        <SheetBody className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="traveler-category-name">{pricingCategoryMessages.nameLabel}</Label>
              <Input
                id="traveler-category-name"
                autoFocus
                value={state.name}
                placeholder={priceRuleMessages.travelerCategoryNamePlaceholder}
                onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="traveler-category-code">{pricingCategoryMessages.codeLabel}</Label>
              <Input
                id="traveler-category-code"
                value={state.code}
                placeholder={priceRuleMessages.travelerCategoryCodePlaceholder}
                onChange={(event) => setState((prev) => ({ ...prev, code: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>{pricingCategoryMessages.typeLabel}</Label>
              <Select
                value={state.categoryType}
                onValueChange={(value) =>
                  setState((prev) => ({
                    ...prev,
                    categoryType: (value ?? "child") as TravelerCategoryType,
                  }))
                }
                items={travelerCategoryTypes}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {travelerCategoryTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="traveler-category-min-age">
                {pricingCategoryMessages.minAgeLabel}
              </Label>
              <Input
                id="traveler-category-min-age"
                type="number"
                min="0"
                value={state.minAge}
                onChange={(event) => setState((prev) => ({ ...prev, minAge: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="traveler-category-max-age">
                {pricingCategoryMessages.maxAgeLabel}
              </Label>
              <Input
                id="traveler-category-max-age"
                type="number"
                min="0"
                value={state.maxAge}
                onChange={(event) => setState((prev) => ({ ...prev, maxAge: event.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{priceRuleMessages.travelerCategoryAppliesToLabel}</Label>
            <div className="grid gap-2 rounded border p-3 sm:grid-cols-3">
              {units.map((unit) => {
                const checkboxId = `traveler-category-unit-${unit.id}`
                return (
                  <div key={unit.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={checkboxId}
                      checked={state.allowedUnitIds.includes(unit.id)}
                      onCheckedChange={(checked) => toggleUnit(unit.id, checked === true)}
                    />
                    <Label htmlFor={checkboxId} className="font-normal">
                      {unit.name}
                    </Label>
                  </div>
                )
              })}
            </div>
            <p className="text-muted-foreground text-xs">
              {priceRuleMessages.travelerCategoryAppliesToHint}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="traveler-category-condition">
              {priceRuleMessages.travelerCategoryConditionLabel}
            </Label>
            <Textarea
              id="traveler-category-condition"
              value={state.condition}
              placeholder={priceRuleMessages.travelerCategoryConditionPlaceholder}
              onChange={(event) => setState((prev) => ({ ...prev, condition: event.target.value }))}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </SheetBody>
        <SheetFooter className="-mx-6 -mb-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {pricingCategoryMessages.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={create.isPending || update.isPending}>
            {isEditing
              ? priceRuleMessages.updateTravelerCategory
              : priceRuleMessages.createTravelerCategory}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
