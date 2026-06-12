// agent-quality: file-size exception -- owner: products-react; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  type ProductExtraRecord,
  useProductExtraMutation,
  useProductExtras,
} from "@voyantjs/extras-react"
import { formatMessage } from "@voyantjs/i18n"
import {
  type ExtraPriceRuleRecord,
  type PricingCategoryRecord,
  useExtraPriceRuleMutation,
  useExtraPriceRules,
  useOptionPriceRuleMutation,
  useOptionUnitPriceRuleMutation,
  usePricingCategoryMutation,
} from "@voyantjs/pricing-react"
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/ui/components"
import { Checkbox } from "@voyantjs/ui/components/checkbox"
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import type * as React from "react"
import { useEffect, useState } from "react"
import { useVoyantProductsContext } from "../../index.js"
import { useProductDetailMessages } from "./host.js"
import { getExtraPricingModeLabel, ProductExtraDialog } from "./product-extra-dialog.js"
import {
  type OptionPriceRuleData,
  OptionPriceRuleDialog,
} from "./product-option-price-rule-dialog.js"
import { OptionPricingGrid } from "./product-option-pricing-grid.js"
import {
  getOptionPriceRulesQueryOptions,
  getOptionUnitPriceRulesQueryOptions,
  getOptionUnitsQueryOptions,
  getPricingCategoriesQueryOptions,
  type OptionPricingLayout,
} from "./product-options-shared.js"
import type { OptionUnitData } from "./product-unit-dialog.js"
import {
  type OptionUnitPriceRuleData,
  UnitPriceRuleDialog,
} from "./product-unit-price-rule-dialog.js"

function getRulePricingModeLabel(
  value: OptionPriceRuleData["pricingMode"],
  messages: ReturnType<typeof useProductDetailMessages>["products"]["operations"]["priceRules"],
) {
  switch (value) {
    case "per_person":
      return messages.pricingModePerPerson
    case "per_booking":
      return messages.pricingModePerBooking
    case "starting_from":
      return messages.pricingModeStartingFrom
    case "free":
      return messages.pricingModeFree
    case "on_request":
      return messages.pricingModeOnRequest
    default:
      return value
  }
}

export function getUnitTypeLabel(
  type: OptionUnitData["unitType"],
  messages: ReturnType<typeof useProductDetailMessages>["products"]["operations"]["units"],
) {
  switch (type) {
    case "person":
      return messages.typePerson
    case "group":
      return messages.typeGroup
    case "room":
      return messages.typeRoom
    case "vehicle":
      return messages.typeVehicle
    case "service":
      return messages.typeService
    case "other":
      return messages.typeOther
    default:
      return type
  }
}

// Pricing categories that describe the *unit* dimension (room/vehicle — already
// the grid's rows) or a standalone add-on (`service`, handled by the extras
// panel) are not per-traveler price columns. Excluding them stops a product
// whose data carries such categories — e.g. legacy data migrated with a
// "Double room" pricing category alongside the real Adult/Child split — from
// rendering one bogus price column per room next to the traveler columns.
const NON_TRAVELER_CATEGORY_TYPES = new Set<PricingCategoryRecord["categoryType"]>([
  "room",
  "vehicle",
  "service",
])

export function isTravelerCategory(category: {
  categoryType: PricingCategoryRecord["categoryType"]
}) {
  return !NON_TRAVELER_CATEGORY_TYPES.has(category.categoryType)
}

export function getCategoryCondition(metadata: Record<string, unknown> | null | undefined) {
  const condition = metadata?.condition
  return typeof condition === "string" && condition.trim().length > 0 ? condition : null
}

export function categoryAppliesToUnit(
  category: { id: string | null; metadata?: Record<string, unknown> | null },
  unit: OptionUnitData,
) {
  if (!category.id) return true
  const allowedUnitIds = category.metadata?.allowedUnitIds
  if (!Array.isArray(allowedUnitIds) || allowedUnitIds.length === 0) return true
  return allowedUnitIds.includes(unit.id)
}

function ActionMenu({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Per-option pricing surface. The everyday view is the merged rooms/seats
 * grid; the full rate-plan machinery (multiple plans, catalogs, cost prices,
 * cancellation) plus any injected per-departure inventory live behind an
 * Advanced disclosure so low-tech agents never have to see them.
 */
export function PricingPanel({
  productId,
  optionId,
  optionName,
  productCurrency,
  layout,
  extras,
}: {
  productId: string
  optionId: string
  optionName: string
  productCurrency: string
  layout: OptionPricingLayout
  extras?: React.ReactNode
}) {
  const messages = useProductDetailMessages()
  const gridMessages = messages.products.operations.pricingGrid
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <OptionPricingGrid
        productId={productId}
        optionId={optionId}
        optionName={optionName}
        productCurrency={productCurrency}
        layout={layout}
      />

      <div className="rounded-md border bg-background/60">
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {advancedOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <span>{gridMessages.advancedToggle}</span>
          {!advancedOpen ? (
            <span className="font-normal normal-case">— {gridMessages.advancedHint}</span>
          ) : null}
        </button>
        {advancedOpen ? (
          <div className="flex flex-col gap-4 border-t p-3">
            <AdvancedRatePlans
              productId={productId}
              optionId={optionId}
              productCurrency={productCurrency}
            />
          </div>
        ) : null}
      </div>

      {/* Per-departure inventory is its own concern (not a pricing/rate-plan
          setting), so it lives in its own collapsible slot below Advanced. */}
      {extras}
    </div>
  )
}

function AdvancedRatePlans({
  productId,
  optionId,
  productCurrency,
}: {
  productId: string
  optionId: string
  productCurrency: string
}) {
  const messages = useProductDetailMessages()
  const client = useVoyantProductsContext()
  const priceRuleMessages = messages.products.operations.priceRules
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<OptionPriceRuleData | undefined>()
  const { data, refetch } = useQuery(getOptionPriceRulesQueryOptions(client, optionId))
  const { remove: removeRule } = useOptionPriceRuleMutation()
  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeRule.mutateAsync(id),
    onSuccess: () => void refetch(),
  })
  const rules = data?.data ?? []
  // The default rate plan IS the everyday grid above — don't re-render its
  // identical matrix here. Advanced only manages the *extra* plans (net,
  // contract, promo) plus the default plan's hidden settings (cost,
  // cancellation, catalog) via "Edit default pricing".
  const defaultRule = rules.find((rule) => rule.isDefault) ?? rules[0]
  const additionalRules = rules.filter((rule) => rule.id !== defaultRule?.id)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {priceRuleMessages.additionalSectionTitle}
          </p>
          <p className="text-xs text-muted-foreground">
            {priceRuleMessages.additionalSectionDescription}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {defaultRule ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingRule(defaultRule)
                setRuleDialogOpen(true)
              }}
            >
              {priceRuleMessages.editDefaultAction}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingRule(undefined)
              setRuleDialogOpen(true)
            }}
          >
            <Plus className="mr-1 h-3 w-3" />
            {priceRuleMessages.addAction}
          </Button>
        </div>
      </div>

      {additionalRules.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          {priceRuleMessages.additionalEmpty}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {additionalRules.map((rule) => (
            <PriceRuleCard
              key={rule.id}
              rule={rule}
              productId={productId}
              optionId={optionId}
              productCurrency={productCurrency}
              onEdit={() => {
                setEditingRule(rule)
                setRuleDialogOpen(true)
              }}
              onDelete={() => {
                if (
                  confirm(formatMessage(priceRuleMessages.deleteRuleConfirm, { name: rule.name }))
                ) {
                  deleteMutation.mutate(rule.id)
                }
              }}
            />
          ))}
        </div>
      )}

      <OptionPriceRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        productId={productId}
        optionId={optionId}
        rule={editingRule}
        onSuccess={() => {
          setRuleDialogOpen(false)
          setEditingRule(undefined)
          void refetch()
        }}
      />
    </div>
  )
}

function PriceRuleCard({
  rule,
  productId,
  optionId,
  productCurrency,
  onEdit,
  onDelete,
}: {
  rule: OptionPriceRuleData
  productId: string
  optionId: string
  productCurrency: string
  onEdit: () => void
  onDelete: () => void
}) {
  const messages = useProductDetailMessages()
  const priceRuleMessages = messages.products.operations.priceRules
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{rule.name}</span>
            <Badge variant="outline" className="text-xs capitalize">
              {getRulePricingModeLabel(rule.pricingMode, priceRuleMessages)}
            </Badge>
            {rule.isDefault && <Badge variant="secondary">{priceRuleMessages.defaultBadge}</Badge>}
            <Badge variant={rule.active ? "default" : "outline"}>
              {rule.active ? priceRuleMessages.activeBadge : priceRuleMessages.inactiveBadge}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {priceRuleMessages.baseSellLabel}:{" "}
              <span className="font-mono text-foreground">
                {formatProductMoney(rule.baseSellAmountCents, productCurrency)}
              </span>
            </span>
            <span>
              {priceRuleMessages.baseCostLabel}:{" "}
              <span className="font-mono text-foreground">
                {formatProductMoney(rule.baseCostAmountCents, productCurrency)}
              </span>
            </span>
            {rule.allPricingCategories && <span>{priceRuleMessages.allCategoriesLabel}</span>}
          </div>
        </div>
        <ActionMenu>
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            {priceRuleMessages.editAction}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            {priceRuleMessages.deleteAction}
          </DropdownMenuItem>
        </ActionMenu>
      </div>

      <div className="mt-3">
        <UnitPriceMatrix
          productId={productId}
          optionPriceRuleId={rule.id}
          optionId={optionId}
          pricingMode={rule.pricingMode}
          allPricingCategories={rule.allPricingCategories}
          productCurrency={productCurrency}
        />
        <ExtraPriceRulesPanel
          productId={productId}
          optionId={optionId}
          optionPriceRuleId={rule.id}
          productCurrency={productCurrency}
        />
      </div>
    </div>
  )
}

function UnitPriceMatrix({
  productId,
  optionPriceRuleId,
  optionId,
  pricingMode,
  allPricingCategories,
  productCurrency,
}: {
  productId: string
  optionPriceRuleId: string
  optionId: string
  pricingMode: OptionPriceRuleData["pricingMode"]
  allPricingCategories: boolean
  productCurrency: string
}) {
  const messages = useProductDetailMessages()
  const client = useVoyantProductsContext()
  const priceRuleMessages = messages.products.operations.priceRules
  const unitMessages = messages.products.operations.units
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCell, setEditingCell] = useState<OptionUnitPriceRuleData | undefined>()
  const [preselectedUnitId, setPreselectedUnitId] = useState<string | undefined>()
  const [preselectedCategoryId, setPreselectedCategoryId] = useState<string | null | undefined>()
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)

  const { data: unitsData } = useQuery(getOptionUnitsQueryOptions(client, optionId))
  const { data: categoriesData, refetch: refetchCategories } = useQuery(
    getPricingCategoriesQueryOptions(client),
  )
  const { data: cellsData, refetch: refetchCells } = useQuery(
    getOptionUnitPriceRulesQueryOptions(client, optionPriceRuleId),
  )
  const { remove } = useOptionUnitPriceRuleMutation()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove.mutateAsync(id),
    onSuccess: () => void refetchCells(),
  })

  const units = (unitsData?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
  const cells = cellsData?.data ?? []
  const referencedCategoryIds = new Set(
    cells.flatMap((cell) => (cell.pricingCategoryId ? [cell.pricingCategoryId] : [])),
  )
  const categories = (categoriesData?.data ?? []).filter(
    (category) =>
      category.active &&
      ((isTravelerCategory(category) &&
        (category.productId == null || category.productId === productId) &&
        (category.optionId == null || category.optionId === optionId)) ||
        referencedCategoryIds.has(category.id)),
  )
  const isPersonOnly = units.length > 0 && units.every((unit) => unit.unitType === "person")
  const findCell = (unitId: string, categoryId: string | null) =>
    cells.find(
      (cell) => cell.unitId === unitId && (cell.pricingCategoryId ?? null) === categoryId,
    ) ?? null

  if (units.length === 0) {
    return <p className="text-xs italic text-muted-foreground">{priceRuleMessages.addUnitsHint}</p>
  }

  if (pricingMode === "per_booking") {
    return (
      <p className="text-xs italic text-muted-foreground">{priceRuleMessages.perBookingFlatHint}</p>
    )
  }

  // Per-pax tour with no category cross-cut: render a simple unit-only table
  // (Sell / Cost) instead of the unit×category matrix. Operators on
  // accommodation products (or rules with allPricingCategories=false) still
  // get the full matrix.
  const useSimpleTable = pricingMode === "per_person" && allPricingCategories

  const tableTitle = useSimpleTable
    ? isPersonOnly
      ? priceRuleMessages.personUnitPricingTitle
      : priceRuleMessages.unitPricingTitle
    : isPersonOnly
      ? priceRuleMessages.personUnitCategoryTitle
      : priceRuleMessages.unitCategoryTitle
  const unitColumnLabel = isPersonOnly
    ? priceRuleMessages.tableTravelerUnit
    : priceRuleMessages.tableUnit

  const columns: Array<{
    id: string | null
    name: string
    metadata?: Record<string, unknown> | null
  }> = useSimpleTable
    ? [{ id: null, name: priceRuleMessages.tableSell }]
    : categories.length > 0
      ? categories.map((category) => ({
          id: category.id,
          name: category.name,
          metadata: category.metadata,
        }))
      : [{ id: null, name: priceRuleMessages.defaultBadge }]

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {tableTitle}
        </p>
        {!useSimpleTable ? (
          <Button variant="outline" size="sm" onClick={() => setCategoryDialogOpen(true)}>
            <Plus className="mr-1 h-3 w-3" />
            {priceRuleMessages.addTravelerCategory}
          </Button>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50 text-muted-foreground">
              <th className="p-2 text-left font-medium">{unitColumnLabel}</th>
              {columns.map((category) => {
                const condition = getCategoryCondition(category.metadata)
                return (
                  <th key={category.id ?? "__default__"} className="p-2 text-left font-medium">
                    <div>{category.name}</div>
                    {condition ? (
                      <div className="mt-0.5 max-w-[220px] text-[10px] font-normal leading-snug text-muted-foreground normal-case">
                        {condition}
                      </div>
                    ) : null}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id} className="border-b last:border-b-0">
                <td className="p-2 font-medium">
                  {unit.name}
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    ({getUnitTypeLabel(unit.unitType, unitMessages)})
                  </span>
                </td>
                {columns.map((category) => {
                  const cell = findCell(unit.id, category.id)
                  const canPriceCategory = categoryAppliesToUnit(category, unit)
                  return (
                    <td key={category.id ?? "__default__"} className="p-2">
                      {cell ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCell(cell)
                              setPreselectedUnitId(undefined)
                              setPreselectedCategoryId(undefined)
                              setDialogOpen(true)
                            }}
                            className="font-mono text-foreground hover:underline"
                          >
                            {formatProductMoney(cell.sellAmountCents, productCurrency)}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(priceRuleMessages.deleteCellConfirm)) {
                                deleteMutation.mutate(cell.id)
                              }
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ) : canPriceCategory ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCell(undefined)
                            setPreselectedUnitId(unit.id)
                            setPreselectedCategoryId(category.id)
                            setDialogOpen(true)
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TravelerCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        productId={productId}
        units={units}
        nextSortOrder={
          categories.length > 0 ? Math.max(...categories.map((c) => c.sortOrder)) + 1 : 0
        }
        onSuccess={() => {
          setCategoryDialogOpen(false)
          void refetchCategories()
        }}
      />

      <UnitPriceRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        optionPriceRuleId={optionPriceRuleId}
        optionId={optionId}
        units={units}
        productCurrency={productCurrency}
        preselectedUnitId={preselectedUnitId}
        preselectedCategoryId={preselectedCategoryId}
        cell={editingCell}
        onSuccess={() => {
          setDialogOpen(false)
          setEditingCell(undefined)
          setPreselectedUnitId(undefined)
          setPreselectedCategoryId(undefined)
          void refetchCells()
        }}
      />
    </div>
  )
}

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? priceRuleMessages.travelerCategoryEditTitle
              : priceRuleMessages.travelerCategoryDialogTitle}
          </DialogTitle>
          <DialogDescription>
            {priceRuleMessages.travelerCategoryDialogDescription}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
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
        </DialogBody>
        <DialogFooter className="-mx-6 -mb-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {pricingCategoryMessages.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={create.isPending || update.isPending}>
            {isEditing
              ? priceRuleMessages.updateTravelerCategory
              : priceRuleMessages.createTravelerCategory}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ExtraPriceRulesPanel({
  productId,
  optionId,
  optionPriceRuleId,
  ensureOptionPriceRuleId,
  productCurrency,
}: {
  productId: string
  optionId: string
  // Optional: extras can be *defined* before the option has a default rate
  // plan. Pricing requires a rule, so `ensureOptionPriceRuleId` lazily creates
  // one when the operator first sets an extra's price.
  optionPriceRuleId?: string
  ensureOptionPriceRuleId?: () => Promise<string>
  productCurrency: string
}) {
  const messages = useProductDetailMessages()
  const extraPriceMessages = messages.products.operations.extraPrices
  const extraMessages = messages.products.operations.extras
  const extrasQuery = useProductExtras({ productId, limit: 100 })
  const rulesQuery = useExtraPriceRules({
    optionPriceRuleId: optionPriceRuleId ?? "__none__",
    optionId,
    active: true,
    limit: 100,
    enabled: !!optionPriceRuleId,
  })
  const { remove: removeExtra } = useProductExtraMutation()
  const [pricingExtraId, setPricingExtraId] = useState<string | null>(null)
  const [pricingRuleId, setPricingRuleId] = useState<string | undefined>(optionPriceRuleId)
  const [definitionDialogOpen, setDefinitionDialogOpen] = useState(false)
  const [editingExtra, setEditingExtra] = useState<ProductExtraRecord | undefined>()
  const extras = (extrasQuery.data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
  const rules = rulesQuery.data?.data ?? []
  const ruleByExtraId = new Map(
    rules.flatMap((rule) => (rule.productExtraId ? [[rule.productExtraId, rule] as const] : [])),
  )
  const pricingExtra = extras.find((extra) => extra.id === pricingExtraId) ?? null

  return (
    <div className="mt-4 border-t pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {extraMessages.sectionTitle}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingExtra(undefined)
            setDefinitionDialogOpen(true)
          }}
        >
          <Plus className="mr-1 h-3 w-3" />
          {extraMessages.addAction}
        </Button>
      </div>
      {extras.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">{extraMessages.empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {extras.map((extra) => {
            const rule = ruleByExtraId.get(extra.id)
            return (
              <div
                key={extra.id}
                className="flex items-center justify-between gap-3 rounded border px-2 py-1.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="font-medium">{extra.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {getExtraPricingModeLabel(extra.pricingMode, extraMessages)}
                  </Badge>
                  {extra.pricedPerPerson ? (
                    <span className="text-muted-foreground">{extraPriceMessages.perTraveler}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">
                    {rule?.sellAmountCents != null
                      ? formatProductMoney(rule.sellAmountCents, productCurrency)
                      : extraPriceMessages.noAmount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void (async () => {
                        const ruleId =
                          optionPriceRuleId ??
                          (ensureOptionPriceRuleId ? await ensureOptionPriceRuleId() : undefined)
                        if (!ruleId) return
                        setPricingRuleId(ruleId)
                        setPricingExtraId(extra.id)
                      })()
                    }}
                  >
                    {extraPriceMessages.setPrice}
                  </Button>
                  <button
                    type="button"
                    aria-label={extraMessages.editAction}
                    onClick={() => {
                      setEditingExtra(extra)
                      setDefinitionDialogOpen(true)
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={extraMessages.deleteAction}
                    onClick={() => {
                      if (
                        confirm(formatMessage(extraMessages.deleteConfirm, { name: extra.name }))
                      ) {
                        removeExtra.mutate(extra.id, {
                          onSuccess: () => void extrasQuery.refetch(),
                        })
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <ProductExtraDialog
        open={definitionDialogOpen}
        onOpenChange={(open) => {
          setDefinitionDialogOpen(open)
          if (!open) setEditingExtra(undefined)
        }}
        productId={productId}
        extra={editingExtra}
        nextSortOrder={extras.length}
        onSuccess={() => {
          setDefinitionDialogOpen(false)
          setEditingExtra(undefined)
          void extrasQuery.refetch()
        }}
      />
      {pricingExtra && (pricingRuleId ?? optionPriceRuleId) ? (
        <ExtraPriceRuleDialog
          open={!!pricingExtra}
          onOpenChange={(open) => {
            if (!open) setPricingExtraId(null)
          }}
          optionPriceRuleId={(pricingRuleId ?? optionPriceRuleId) as string}
          optionId={optionId}
          extra={pricingExtra}
          existingRule={ruleByExtraId.get(pricingExtra.id)}
          nextSortOrder={rules.length}
          productCurrency={productCurrency}
          onSuccess={() => {
            setPricingExtraId(null)
            void rulesQuery.refetch()
          }}
        />
      ) : null}
    </div>
  )
}

function ExtraPriceRuleDialog({
  open,
  onOpenChange,
  optionPriceRuleId,
  optionId,
  extra,
  existingRule,
  nextSortOrder,
  productCurrency,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  optionPriceRuleId: string
  optionId: string
  extra: { id: string; name: string; pricingMode: string; pricedPerPerson: boolean }
  existingRule?: ExtraPriceRuleRecord
  nextSortOrder: number
  productCurrency: string
  onSuccess: () => void
}) {
  const messages = useProductDetailMessages()
  const extraPriceMessages = messages.products.operations.extraPrices
  const { create, update } = useExtraPriceRuleMutation()
  const [amount, setAmount] = useState("")
  const [pricingMode, setPricingMode] = useState<ExtraPriceRuleRecord["pricingMode"]>("per_booking")

  const isEditing = !!existingRule
  const pricingModes = [
    { value: "per_booking", label: extraPriceMessages.pricingPerBooking },
    { value: "per_person", label: extraPriceMessages.pricingPerPerson },
    { value: "included", label: extraPriceMessages.pricingIncluded },
    { value: "on_request", label: extraPriceMessages.pricingOnRequest },
    { value: "unavailable", label: extraPriceMessages.pricingUnavailable },
  ] as const

  useEffect(() => {
    setAmount(
      existingRule?.sellAmountCents != null ? String(existingRule.sellAmountCents / 100) : "",
    )
    setPricingMode(existingRule?.pricingMode ?? defaultExtraPriceRuleMode(extra))
  }, [existingRule, extra])

  const save = async () => {
    const parsedAmount = amount.trim() === "" ? null : Math.round(Number(amount) * 100)
    if (parsedAmount != null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) return
    const payload = {
      optionPriceRuleId,
      optionId,
      productExtraId: extra.id,
      optionExtraConfigId: null,
      pricingMode,
      sellAmountCents: parsedAmount,
      costAmountCents: null,
      active: true,
      sortOrder: existingRule?.sortOrder ?? nextSortOrder,
    }
    if (existingRule) await update.mutateAsync({ id: existingRule.id, input: payload })
    else await create.mutateAsync(payload)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? extraPriceMessages.editTitle : extraPriceMessages.newTitle}
          </DialogTitle>
          <DialogDescription>{extra.name}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="flex flex-col gap-2">
            <Label>{extraPriceMessages.pricingModeLabel}</Label>
            <Select
              value={pricingMode}
              onValueChange={(value) =>
                setPricingMode((value ?? "per_booking") as ExtraPriceRuleRecord["pricingMode"])
              }
              items={pricingModes}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pricingModes.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{extraPriceMessages.sellAmountLabel}</Label>
            <div className="flex items-center gap-2">
              <Input
                value={amount}
                type="number"
                min="0"
                step="0.01"
                onChange={(event) => setAmount(event.target.value)}
              />
              <span className="min-w-12 text-muted-foreground text-sm">{productCurrency}</span>
            </div>
          </div>
        </DialogBody>
        <DialogFooter className="-mx-6 -mb-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {extraPriceMessages.cancel}
          </Button>
          <Button onClick={() => void save()}>{extraPriceMessages.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function defaultExtraPriceRuleMode(extra: {
  pricingMode: string
  pricedPerPerson: boolean
}): ExtraPriceRuleRecord["pricingMode"] {
  if (extra.pricedPerPerson || extra.pricingMode === "per_person") return "per_person"
  if (extra.pricingMode === "included" || extra.pricingMode === "free") return "included"
  if (extra.pricingMode === "on_request") return "on_request"
  return "per_booking"
}

export function formatProductMoney(amountCents: number | null | undefined, currency: string) {
  if (amountCents == null) return "-"
  return `${(amountCents / 100).toFixed(2)} ${currency}`
}
