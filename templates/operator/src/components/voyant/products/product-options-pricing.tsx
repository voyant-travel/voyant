import { useMutation, useQuery } from "@tanstack/react-query"
import { formatMessage } from "@voyantjs/admin"
import { useOptionPriceRuleMutation, useOptionUnitPriceRuleMutation } from "@voyantjs/pricing-react"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voyantjs/ui/components"
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { type OptionPriceRuleData, OptionPriceRuleDialog } from "./product-option-price-rule-dialog"
import {
  getOptionPriceRulesQueryOptions,
  getOptionUnitPriceRulesQueryOptions,
  getOptionUnitsQueryOptions,
  getPricingCategoriesQueryOptions,
} from "./product-options-shared"
import type { OptionUnitData } from "./product-unit-dialog"
import { type OptionUnitPriceRuleData, UnitPriceRuleDialog } from "./product-unit-price-rule-dialog"

function getRulePricingModeLabel(
  value: OptionPriceRuleData["pricingMode"],
  messages: ReturnType<typeof useAdminMessages>["products"]["operations"]["priceRules"],
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

function getUnitTypeLabel(
  type: OptionUnitData["unitType"],
  messages: ReturnType<typeof useAdminMessages>["products"]["operations"]["units"],
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

export function PricingPanel({ productId, optionId }: { productId: string; optionId: string }) {
  const messages = useAdminMessages()
  const priceRuleMessages = messages.products.operations.priceRules
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<OptionPriceRuleData | undefined>()
  const { data, refetch } = useQuery(getOptionPriceRulesQueryOptions(optionId))
  const { remove: removeRule } = useOptionPriceRuleMutation()
  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeRule.mutateAsync(id),
    onSuccess: () => void refetch(),
  })
  const rules = data?.data ?? []

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {priceRuleMessages.sectionTitle}
        </p>
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

      {rules.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">{priceRuleMessages.empty}</p>
      ) : (
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
  optionId,
  onEdit,
  onDelete,
}: {
  rule: OptionPriceRuleData
  optionId: string
  onEdit: () => void
  onDelete: () => void
}) {
  const messages = useAdminMessages()
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
                {((rule.baseSellAmountCents ?? 0) / 100).toFixed(2)}
              </span>
            </span>
            <span>
              {priceRuleMessages.baseCostLabel}:{" "}
              <span className="font-mono text-foreground">
                {((rule.baseCostAmountCents ?? 0) / 100).toFixed(2)}
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
        <UnitPriceMatrix optionPriceRuleId={rule.id} optionId={optionId} />
      </div>
    </div>
  )
}

function UnitPriceMatrix({
  optionPriceRuleId,
  optionId,
}: {
  optionPriceRuleId: string
  optionId: string
}) {
  const messages = useAdminMessages()
  const priceRuleMessages = messages.products.operations.priceRules
  const unitMessages = messages.products.operations.units
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
    onSuccess: () => void refetchCells(),
  })

  const units = (unitsData?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
  const categories = categoriesData?.data ?? []
  const columns =
    categories.length > 0
      ? categories.map((category) => ({ id: category.id, name: category.name }))
      : [{ id: null, name: priceRuleMessages.defaultBadge }]
  const cells = cellsData?.data ?? []
  const findCell = (unitId: string, categoryId: string | null) =>
    cells.find(
      (cell) => cell.unitId === unitId && (cell.pricingCategoryId ?? null) === categoryId,
    ) ?? null

  if (units.length === 0) {
    return <p className="text-xs italic text-muted-foreground">{priceRuleMessages.addUnitsHint}</p>
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {priceRuleMessages.unitCategoryTitle}
        </p>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50 text-muted-foreground">
              <th className="p-2 text-left font-medium">{priceRuleMessages.tableUnit}</th>
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
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    ({getUnitTypeLabel(unit.unitType, unitMessages)})
                  </span>
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
                              if (confirm(priceRuleMessages.deleteCellConfirm)) {
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
