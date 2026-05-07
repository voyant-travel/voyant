import { useMutation, useQuery } from "@tanstack/react-query"
import { useOptionPriceRuleMutation, useOptionUnitPriceRuleMutation } from "@voyantjs/pricing-react"
import { Badge, Button } from "@voyantjs/ui/components"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { type OptionPriceRuleData, OptionPriceRuleDialog } from "./product-option-price-rule-dialog"
import {
  getOptionPriceRulesQueryOptions,
  getOptionUnitPriceRulesQueryOptions,
  getOptionUnitsQueryOptions,
  getPricingCategoriesQueryOptions,
} from "./product-options-shared"
import { type OptionUnitPriceRuleData, UnitPriceRuleDialog } from "./product-unit-price-rule-dialog"

export function PricingPanel({ productId, optionId }: { productId: string; optionId: string }) {
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<OptionPriceRuleData | undefined>()
  const { remove: removeRule } = useOptionPriceRuleMutation()

  const { data, refetch } = useQuery(getOptionPriceRulesQueryOptions(optionId))

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeRule.mutateAsync(id),
    onSuccess: () => {
      void refetch()
    },
  })

  const rules = data?.data ?? []

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pricing</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingRule(undefined)
            setRuleDialogOpen(true)
          }}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Price Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          No price rules yet. Link a catalog to start pricing.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {rules.map((rule) => (
          <PriceRuleCard
            key={rule.id}
            rule={rule}
            optionId={optionId}
            onEdit={() => {
              setEditingRule(rule)
              setRuleDialogOpen(true)
            }}
            onDelete={() => {
              if (confirm(`Delete price rule "${rule.name}"?`)) {
                deleteMutation.mutate(rule.id)
              }
            }}
          />
        ))}
      </div>

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
  optionId,
  onEdit,
  onDelete,
}: {
  rule: OptionPriceRuleData
  optionId: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded border bg-background p-3">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{rule.name}</span>
            <Badge variant="outline" className="text-xs capitalize">
              {rule.pricingMode.replace("_", " ")}
            </Badge>
            {rule.isDefault ? <Badge variant="secondary">Default</Badge> : null}
            <Badge variant={rule.active ? "default" : "outline"}>
              {rule.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Base sell:{" "}
              <span className="font-mono text-foreground">
                {((rule.baseSellAmountCents ?? 0) / 100).toFixed(2)}
              </span>
            </span>
            <span>
              Base cost:{" "}
              <span className="font-mono text-foreground">
                {((rule.baseCostAmountCents ?? 0) / 100).toFixed(2)}
              </span>
            </span>
            {rule.allPricingCategories ? <span>All categories</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-3">
        <UnitPriceMatrix
          optionPriceRuleId={rule.id}
          optionId={optionId}
          pricingMode={rule.pricingMode}
          allPricingCategories={rule.allPricingCategories}
        />
      </div>
    </div>
  )
}

function UnitPriceMatrix({
  optionPriceRuleId,
  optionId,
  pricingMode,
  allPricingCategories,
}: {
  optionPriceRuleId: string
  optionId: string
  pricingMode: OptionPriceRuleData["pricingMode"]
  allPricingCategories: boolean
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCell, setEditingCell] = useState<OptionUnitPriceRuleData | undefined>()
  const [preselectedUnitId, setPreselectedUnitId] = useState<string | undefined>()
  const [preselectedCategoryId, setPreselectedCategoryId] = useState<string | null | undefined>()

  const { data: unitsData } = useQuery(getOptionUnitsQueryOptions(optionId))
  const { data: categoriesData } = useQuery(getPricingCategoriesQueryOptions())
  const { data: cellsData, refetch: refetchCells } = useQuery(
    getOptionUnitPriceRulesQueryOptions(optionPriceRuleId),
  )
  const { remove } = useOptionUnitPriceRuleMutation()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove.mutateAsync(id),
    onSuccess: () => {
      void refetchCells()
    },
  })

  const units = (unitsData?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
  const categories = categoriesData?.data ?? []
  const cells = cellsData?.data ?? []

  const findCell = (unitId: string, categoryId: string | null) =>
    cells.find(
      (cell) => cell.unitId === unitId && (cell.pricingCategoryId ?? null) === categoryId,
    ) ?? null

  if (units.length === 0) {
    return <p className="text-xs italic text-muted-foreground">Add units to configure pricing.</p>
  }

  // Per-pax tour with no category cross-cut: render a simple unit-only table
  // (Sell column) instead of the unit×category matrix. Accommodation products
  // (or rules with allPricingCategories=false) still get the full matrix.
  const useSimpleTable = pricingMode === "per_person" && allPricingCategories

  if (!useSimpleTable && categories.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">
        Create global pricing categories in Settings first.
      </p>
    )
  }

  const columns: Array<{ id: string | null; name: string }> = useSimpleTable
    ? [{ id: null, name: "Sell" }]
    : categories.map((category) => ({ id: category.id, name: category.name }))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {useSimpleTable ? "Unit Pricing" : "Unit × Category Pricing"}
        </p>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50 text-muted-foreground">
              <th className="p-2 text-left font-medium">Unit</th>
              {columns.map((category) => (
                <th key={category.id ?? "__default__"} className="p-2 text-left font-medium">
                  {category.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id} className="border-b last:border-b-0">
                <td className="p-2 font-medium">
                  {unit.name}
                  <span className="ml-1 text-[10px] text-muted-foreground">({unit.unitType})</span>
                </td>
                {columns.map((category) => {
                  const cell = findCell(unit.id, category.id)
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
                            {((cell.sellAmountCents ?? 0) / 100).toFixed(2)}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Delete this price cell?")) {
                                deleteMutation.mutate(cell.id)
                              }
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
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
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UnitPriceRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        optionPriceRuleId={optionPriceRuleId}
        optionId={optionId}
        units={units}
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
