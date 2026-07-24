import { useMutation, useQuery } from "@tanstack/react-query"
import { Button, confirmDialog } from "@voyant-travel/ui/components"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useVoyantProductsContext } from "../../index.js"
import { useOptionUnitPriceRuleMutation } from "./commerce-client.js"
import { useProductDetailApi, useProductDetailMessages } from "./host.js"
import type { OptionPriceRuleData } from "./product-option-price-rule-dialog.js"
import {
  categoryAppliesToUnit,
  formatProductMoney,
  formatUnitPriceCellActionLabel,
  getCategoryCondition,
  getUnitTypeLabel,
  isTravelerCategory,
} from "./product-options-pricing-helpers.js"
import {
  getProductDetailOptionUnitPriceRulesQueryOptions,
  getProductDetailOptionUnitsQueryOptions,
  getProductDetailPricingCategoriesQueryOptions,
} from "./product-options-shared.js"
import { TravelerCategoryDialog } from "./product-options-traveler-category-dialog.js"
import type { OptionUnitPriceRuleData } from "./product-unit-price-rule-dialog.js"
import { UnitPriceRuleDialog } from "./product-unit-price-rule-dialog.js"

export function UnitPriceMatrix({
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
  const productsClient = useVoyantProductsContext()
  const api = useProductDetailApi()
  const priceRuleMessages = messages.products.operations.priceRules
  const unitMessages = messages.products.operations.units
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCell, setEditingCell] = useState<OptionUnitPriceRuleData | undefined>()
  const [preselectedUnitId, setPreselectedUnitId] = useState<string | undefined>()
  const [preselectedCategoryId, setPreselectedCategoryId] = useState<string | null | undefined>()
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)

  const { data: unitsData } = useQuery(
    getProductDetailOptionUnitsQueryOptions(productsClient, optionId),
  )
  const { data: categoriesData, refetch: refetchCategories } = useQuery(
    getProductDetailPricingCategoriesQueryOptions(api),
  )
  const { data: cellsData, refetch: refetchCells } = useQuery(
    getProductDetailOptionUnitPriceRulesQueryOptions(api, optionPriceRuleId),
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
                  const cellAmount = cell
                    ? formatProductMoney(cell.sellAmountCents, productCurrency)
                    : null
                  return (
                    <td key={category.id ?? "__default__"} className="p-2">
                      {cell ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={formatUnitPriceCellActionLabel({
                              action: priceRuleMessages.editAction,
                              amount: cellAmount,
                              unitName: unit.name,
                              categoryName: category.name,
                            })}
                            onClick={() => {
                              setEditingCell(cell)
                              setPreselectedUnitId(undefined)
                              setPreselectedCategoryId(undefined)
                              setDialogOpen(true)
                            }}
                            className="font-mono text-foreground hover:underline"
                          >
                            {cellAmount}
                          </button>
                          <button
                            type="button"
                            aria-label={formatUnitPriceCellActionLabel({
                              action: priceRuleMessages.deleteAction,
                              amount: cellAmount,
                              unitName: unit.name,
                              categoryName: category.name,
                            })}
                            onClick={async () => {
                              if (
                                await confirmDialog({
                                  description: priceRuleMessages.deleteCellConfirm,
                                  destructive: true,
                                })
                              ) {
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
                          aria-label={formatUnitPriceCellActionLabel({
                            action: priceRuleMessages.setUnitCategoryPrice,
                            unitName: unit.name,
                            categoryName: category.name,
                          })}
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
