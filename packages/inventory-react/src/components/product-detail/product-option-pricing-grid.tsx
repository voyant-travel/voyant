// agent-quality: file-size exception -- owner: inventory-react; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { formatMessage } from "@voyant-travel/i18n"
import { confirmDialog } from "@voyant-travel/ui/components"
import { Button } from "@voyant-travel/ui/components/button"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useOptionUnitMutation, useVoyantProductsContext } from "../../index.js"
import {
  type PricingCategoryRecord,
  useOptionPriceRuleMutation,
  useOptionUnitPriceRuleMutation,
  usePriceCatalogMutation,
  usePricingCategoryMutation,
} from "./commerce-client.js"

import { useProductDetailApi, useProductDetailMessages } from "./host.js"
import {
  categoryAppliesToUnit,
  ExtraPriceRulesPanel,
  formatProductMoney,
  formatUnitPriceCellActionLabel,
  getCategoryCondition,
  isTravelerCategory,
  TravelerCategoryDialog,
} from "./product-options-pricing.js"
import {
  getProductDetailOptionPriceRulesQueryOptions,
  getProductDetailOptionUnitPriceRulesQueryOptions,
  getProductDetailOptionUnitsQueryOptions,
  getProductDetailPriceCatalogsQueryOptions,
  getProductDetailPricingCategoriesQueryOptions,
  type OptionPricingLayout,
} from "./product-options-shared.js"
import { UnitDialog } from "./product-unit-dialog.js"
import type { OptionUnitData } from "./product-unit-form.js"
import {
  type OptionUnitPriceRuleData,
  UnitPriceRuleDialog,
} from "./product-unit-price-rule-dialog.js"

type GridMessages = ReturnType<
  typeof useProductDetailMessages
>["products"]["operations"]["pricingGrid"]

function formatAvailability(unit: OptionUnitData, messages: GridMessages) {
  if (unit.maxQuantity != null && unit.maxQuantity > 0) {
    return formatMessage(messages.perDeparture, { count: unit.maxQuantity })
  }
  return "—"
}

function unitSubtitle(unit: OptionUnitData, layout: OptionPricingLayout, messages: GridMessages) {
  if (layout === "rooms") {
    const sleeps = unit.occupancyMax ?? unit.occupancyMin
    return sleeps != null ? formatMessage(messages.sleeps, { count: sleeps }) : null
  }
  if (unit.minAge != null || unit.maxAge != null) {
    return `${unit.minAge ?? 0}–${unit.maxAge ?? "∞"}`
  }
  return null
}

export interface OptionPricingGridProps {
  productId: string
  optionId: string
  optionName: string
  productCurrency: string
  layout: OptionPricingLayout
}

/**
 * The everyday pricing surface for a booking option: one table that merges
 * inventory (rooms / traveler types) with what each traveler pays. The single
 * default rate plan is auto-managed and hidden — agents never see catalogs or
 * rate-plan chrome here (that lives under Advanced).
 */
export function OptionPricingGrid({
  productId,
  optionId,
  optionName,
  productCurrency,
  layout,
}: OptionPricingGridProps) {
  const productsClient = useVoyantProductsContext()
  const api = useProductDetailApi()
  const messages = useProductDetailMessages()
  const t = messages.products.operations.pricingGrid
  const priceRuleMessages = messages.products.operations.priceRules

  const { data: unitsData, refetch: refetchUnits } = useQuery(
    getProductDetailOptionUnitsQueryOptions(productsClient, optionId),
  )
  const { data: rulesData, refetch: refetchRules } = useQuery(
    getProductDetailOptionPriceRulesQueryOptions(api, optionId),
  )
  const { data: categoriesData, refetch: refetchCategories } = useQuery(
    getProductDetailPricingCategoriesQueryOptions(api),
  )
  const { data: catalogsData } = useQuery(getProductDetailPriceCatalogsQueryOptions(api))

  const rules = rulesData?.data ?? []
  const defaultRule = rules.find((rule) => rule.isDefault) ?? rules[0]

  const { data: cellsData, refetch: refetchCells } = useQuery({
    ...getProductDetailOptionUnitPriceRulesQueryOptions(api, defaultRule?.id ?? "__none__"),
    enabled: Boolean(defaultRule?.id),
  })

  const { remove: removeUnit } = useOptionUnitMutation()
  const { remove: removeCell } = useOptionUnitPriceRuleMutation()
  const { create: createRule } = useOptionPriceRuleMutation()
  const { create: createCatalog } = usePriceCatalogMutation()
  const { remove: removeCategory } = usePricingCategoryMutation()

  const deleteUnitMutation = useMutation({
    mutationFn: (id: string) => removeUnit.mutateAsync(id),
    onSuccess: () => {
      void refetchUnits()
      void refetchCells()
    },
  })
  const deleteCellMutation = useMutation({
    mutationFn: (id: string) => removeCell.mutateAsync(id),
    onSuccess: () => void refetchCells(),
  })

  const [unitDialogOpen, setUnitDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<OptionUnitData | undefined>()
  const [defaultUnitType, setDefaultUnitType] = useState<OptionUnitData["unitType"]>("room")
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<PricingCategoryRecord | undefined>()
  const [cellDialogOpen, setCellDialogOpen] = useState(false)
  const [cellRuleId, setCellRuleId] = useState<string | undefined>()
  const [editingCell, setEditingCell] = useState<OptionUnitPriceRuleData | undefined>()
  const [preselectedUnitId, setPreselectedUnitId] = useState<string | undefined>()
  const [preselectedCategoryId, setPreselectedCategoryId] = useState<string | null | undefined>()

  const units = (unitsData?.data ?? [])
    .filter((unit) => !unit.isHidden)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)

  // Inventory wins over the booking-mode hint: an option that actually holds
  // rooms (or vehicles/groups) is always priced as a rooms grid, even if the
  // product's booking mode was set to a per-person type. The `layout` prop only
  // decides the shape for a brand-new option that has no inventory yet.
  const hasRoomLikeUnits = units.some(
    (unit) => unit.unitType === "room" || unit.unitType === "vehicle" || unit.unitType === "group",
  )
  const hasPersonUnits = units.some((unit) => unit.unitType === "person")
  const effectiveLayout: OptionPricingLayout = hasRoomLikeUnits
    ? "rooms"
    : hasPersonUnits
      ? "seats"
      : layout

  const cells = cellsData?.data ?? []
  const referencedCategoryIds = new Set(
    cells.flatMap((cell) => (cell.pricingCategoryId ? [cell.pricingCategoryId] : [])),
  )
  const categories = (categoriesData?.data ?? [])
    .filter(
      (category) =>
        category.active &&
        ((isTravelerCategory(category) &&
          (category.productId == null || category.productId === productId) &&
          (category.optionId == null || category.optionId === optionId)) ||
          referencedCategoryIds.has(category.id)),
    )
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)

  // Traveler-type columns. Seats layout prices each traveler-type row once
  // (single price column). Rooms layout splits price by traveler category once
  // any exist, else shows a single base-price column per room.
  const columns: Array<{
    id: string | null
    name: string
    metadata?: Record<string, unknown> | null
  }> =
    effectiveLayout === "rooms" && categories.length > 0
      ? categories.map((category) => ({
          id: category.id,
          name: category.name,
          metadata: category.metadata,
        }))
      : [{ id: null, name: t.priceColumn }]

  const nextUnitSortOrder = units.length > 0 ? Math.max(...units.map((u) => u.sortOrder)) + 1 : 0

  const findCell = (unitId: string, categoryId: string | null) =>
    cells.find(
      (cell) => cell.unitId === unitId && (cell.pricingCategoryId ?? null) === categoryId,
    ) ?? null

  // Lazily materialize the hidden default rate plan (and a default catalog if
  // the tenant has none) the first time the agent enters a price. Keeps the
  // common path free of any rate-plan/catalog ceremony.
  async function ensureRatePlanId(): Promise<string> {
    if (defaultRule?.id) return defaultRule.id

    const catalogs = catalogsData?.data ?? []
    const existingCatalog = catalogs.find((catalog) => catalog.isDefault) ?? catalogs[0]
    const catalogId =
      existingCatalog?.id ??
      (
        await createCatalog.mutateAsync({
          code: "default",
          name: t.priceColumn,
          catalogType: "public",
          isDefault: true,
        })
      ).id

    const created = await createRule.mutateAsync({
      productId,
      optionId,
      priceCatalogId: catalogId,
      name: optionName,
      pricingMode: "per_person",
      baseSellAmountCents: 0,
      baseCostAmountCents: 0,
      allPricingCategories: effectiveLayout === "seats",
      isDefault: true,
      active: true,
    })
    await refetchRules()
    return created.id
  }

  async function openCellDialog(unit: OptionUnitData, categoryId: string | null) {
    const ruleId = await ensureRatePlanId()
    setCellRuleId(ruleId)
    setEditingCell(undefined)
    setPreselectedUnitId(unit.id)
    setPreselectedCategoryId(categoryId)
    setCellDialogOpen(true)
  }

  const addRoomOrTraveler = () => {
    setEditingUnit(undefined)
    setDefaultUnitType(effectiveLayout === "rooms" ? "room" : "person")
    setUnitDialogOpen(true)
  }

  const editTravelerType = (category: PricingCategoryRecord) => {
    setEditingCategory(category)
    setCategoryDialogOpen(true)
  }

  async function removeTravelerType(category: PricingCategoryRecord) {
    if (
      !(await confirmDialog({
        description: formatMessage(
          messages.products.operations.priceRules.travelerCategoryDeleteConfirm,
          {
            name: category.name,
          },
        ),
        destructive: true,
      }))
    ) {
      return
    }
    // Categories this product/option owns are deleted outright. A global
    // category only shows here because some cell references it, so removing
    // its prices drops the column from this option without touching the
    // shared category.
    if (category.productId === productId || category.optionId === optionId) {
      await removeCategory.mutateAsync(category.id)
      void refetchCategories()
      void refetchCells()
    } else {
      for (const cell of cells.filter((entry) => entry.pricingCategoryId === category.id)) {
        await removeCell.mutateAsync(cell.id)
      }
      void refetchCells()
    }
  }

  const unitColumnLabel = effectiveLayout === "rooms" ? t.roomColumn : t.travelerColumn

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {effectiveLayout === "rooms" ? t.roomsTitle : t.seatsTitle}
          </p>
          <p className="text-xs text-muted-foreground">
            {effectiveLayout === "rooms" ? t.roomsDescription : t.seatsDescription}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {effectiveLayout === "rooms" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingCategory(undefined)
                setCategoryDialogOpen(true)
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t.addTravelerType}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={addRoomOrTraveler}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {effectiveLayout === "rooms" ? t.addRoom : t.addTravelerType}
          </Button>
        </div>
      </div>

      {units.length === 0 ? (
        <p className="rounded-md border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
          {effectiveLayout === "rooms" ? t.emptyRooms : t.emptySeats}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th className="p-2.5 text-left font-medium">{unitColumnLabel}</th>
                <th className="p-2.5 text-left font-medium">{t.availableColumn}</th>
                {columns.map((column) => {
                  const condition = getCategoryCondition(column.metadata)
                  const category = column.id
                    ? categories.find((entry) => entry.id === column.id)
                    : undefined
                  return (
                    <th key={column.id ?? "__base__"} className="group p-2.5 text-left font-medium">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div>{column.name}</div>
                          {condition ? (
                            <div className="mt-0.5 max-w-[220px] text-[10px] font-normal normal-case leading-snug text-muted-foreground">
                              {condition}
                            </div>
                          ) : null}
                        </div>
                        {category ? (
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              aria-label={priceRuleMessages.travelerCategoryEdit}
                              onClick={() => editTravelerType(category)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              aria-label={priceRuleMessages.travelerCategoryDelete}
                              onClick={() => void removeTravelerType(category)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </th>
                  )
                })}
                <th className="w-[72px] p-2.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => {
                const subtitle = unitSubtitle(unit, effectiveLayout, t)
                return (
                  <tr key={unit.id} className="border-b last:border-b-0">
                    <td className="p-2.5">
                      <div className="font-medium">{unit.name}</div>
                      {subtitle ? (
                        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
                      ) : null}
                    </td>
                    <td className="p-2.5 text-muted-foreground">{formatAvailability(unit, t)}</td>
                    {columns.map((column) => {
                      const cell = findCell(unit.id, column.id)
                      const canPrice = categoryAppliesToUnit(column, unit)
                      const cellAmount = cell
                        ? formatProductMoney(cell.sellAmountCents, productCurrency)
                        : null
                      return (
                        <td key={column.id ?? "__base__"} className="p-2.5">
                          {cell ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                aria-label={formatUnitPriceCellActionLabel({
                                  action: priceRuleMessages.editAction,
                                  amount: cellAmount,
                                  unitName: unit.name,
                                  categoryName: column.name,
                                })}
                                onClick={() => {
                                  setCellRuleId(defaultRule?.id)
                                  setEditingCell(cell)
                                  setPreselectedUnitId(undefined)
                                  setPreselectedCategoryId(undefined)
                                  setCellDialogOpen(true)
                                }}
                                className="font-mono text-foreground hover:underline"
                              >
                                {cellAmount}
                              </button>
                              <button
                                type="button"
                                aria-label={t.deleteRoom}
                                onClick={() => deleteCellMutation.mutate(cell.id)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ) : canPrice ? (
                            <button
                              type="button"
                              aria-label={formatUnitPriceCellActionLabel({
                                action: t.setPrice,
                                unitName: unit.name,
                                categoryName: column.name,
                              })}
                              onClick={() => void openCellDialog(unit, column.id)}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Plus className="h-3 w-3" />
                              {t.setPrice}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="p-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t.editRoom}
                          onClick={() => {
                            setEditingUnit(unit)
                            setDefaultUnitType(unit.unitType)
                            setUnitDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t.deleteRoom}
                          onClick={async () => {
                            if (
                              await confirmDialog({
                                description: formatMessage(t.deleteRoomConfirm, {
                                  name: unit.name,
                                }),
                                destructive: true,
                              })
                            ) {
                              deleteUnitMutation.mutate(unit.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add-on extras: defined here (product-level) and priced on the option's
          default plan. Always rendered so extras can be added before any price
          exists; setting a price lazily creates the default rate plan. */}
      <ExtraPriceRulesPanel
        productId={productId}
        optionId={optionId}
        optionPriceRuleId={defaultRule?.id}
        ensureOptionPriceRuleId={ensureRatePlanId}
        productCurrency={productCurrency}
      />

      <UnitDialog
        open={unitDialogOpen}
        onOpenChange={setUnitDialogOpen}
        optionId={optionId}
        unit={editingUnit}
        defaultUnitType={editingUnit ? undefined : defaultUnitType}
        lockUnitType
        nextSortOrder={nextUnitSortOrder}
        onSuccess={() => {
          setUnitDialogOpen(false)
          setEditingUnit(undefined)
          void refetchUnits()
        }}
      />

      <TravelerCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open)
          if (!open) setEditingCategory(undefined)
        }}
        productId={productId}
        units={units}
        category={editingCategory}
        nextSortOrder={
          categories.length > 0 ? Math.max(...categories.map((c) => c.sortOrder)) + 1 : 0
        }
        onSuccess={() => {
          setCategoryDialogOpen(false)
          setEditingCategory(undefined)
          void refetchCategories()
        }}
      />

      {/* Kept mounted (not conditionally rendered) so the controlled `open`
          toggles false→true reliably — mounting a base-ui Sheet already-open
          skips the open transition, which read as "Set price does nothing". */}
      <UnitPriceRuleDialog
        open={cellDialogOpen}
        onOpenChange={setCellDialogOpen}
        optionPriceRuleId={cellRuleId ?? defaultRule?.id ?? ""}
        optionId={optionId}
        units={units}
        productCurrency={productCurrency}
        preselectedUnitId={preselectedUnitId}
        preselectedCategoryId={preselectedCategoryId}
        cell={editingCell}
        onSuccess={() => {
          setCellDialogOpen(false)
          setEditingCell(undefined)
          setPreselectedUnitId(undefined)
          setPreselectedCategoryId(undefined)
          void refetchCells()
        }}
      />
    </div>
  )
}
