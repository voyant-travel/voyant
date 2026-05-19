import { useMutation, useQuery } from "@tanstack/react-query"
import { formatMessage } from "@voyantjs/admin"
import { useProductExtras } from "@voyantjs/extras-react"
import {
  type ExtraPriceRuleRecord,
  useExtraPriceRuleMutation,
  useExtraPriceRules,
  useOptionPriceRuleMutation,
  useOptionUnitPriceRuleMutation,
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
} from "@voyantjs/ui/components"
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
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

export function PricingPanel({
  productId,
  optionId,
  productCurrency,
}: {
  productId: string
  optionId: string
  productCurrency: string
}) {
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
  optionPriceRuleId,
  optionId,
  pricingMode,
  allPricingCategories,
  productCurrency,
}: {
  optionPriceRuleId: string
  optionId: string
  pricingMode: OptionPriceRuleData["pricingMode"]
  allPricingCategories: boolean
  productCurrency: string
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
  const cells = cellsData?.data ?? []
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
    ? priceRuleMessages.unitPricingTitle
    : priceRuleMessages.unitCategoryTitle

  const columns: Array<{ id: string | null; name: string }> = useSimpleTable
    ? [{ id: null, name: priceRuleMessages.tableSell }]
    : categories.length > 0
      ? categories.map((category) => ({ id: category.id, name: category.name }))
      : [{ id: null, name: priceRuleMessages.defaultBadge }]

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {tableTitle}
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

function ExtraPriceRulesPanel({
  productId,
  optionId,
  optionPriceRuleId,
  productCurrency,
}: {
  productId: string
  optionId: string
  optionPriceRuleId: string
  productCurrency: string
}) {
  const messages = useAdminMessages()
  const extraPriceMessages = messages.products.operations.extraPrices
  const extrasQuery = useProductExtras({ productId, active: true, limit: 100 })
  const rulesQuery = useExtraPriceRules({ optionPriceRuleId, optionId, active: true, limit: 100 })
  const { remove } = useExtraPriceRuleMutation()
  const [pricingExtraId, setPricingExtraId] = useState<string | null>(null)
  const extras = extrasQuery.data?.data ?? []
  const rules = rulesQuery.data?.data ?? []
  const ruleByExtraId = new Map(
    rules.flatMap((rule) => (rule.productExtraId ? [[rule.productExtraId, rule] as const] : [])),
  )

  if (extras.length === 0) return null
  const pricingExtra = extras.find((extra) => extra.id === pricingExtraId) ?? null

  return (
    <div className="mt-4 border-t pt-3">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {extraPriceMessages.sectionTitle}
      </div>
      <div className="flex flex-col gap-2">
        {extras.map((extra) => {
          const rule = ruleByExtraId.get(extra.id)
          return (
            <div
              key={extra.id}
              className="flex items-center justify-between gap-3 rounded border px-2 py-1.5 text-xs"
            >
              <div className="min-w-0">
                <span className="font-medium">{extra.name}</span>
                {extra.pricedPerPerson ? (
                  <span className="ml-2 text-muted-foreground">
                    {extraPriceMessages.perTraveler}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono">
                  {rule?.sellAmountCents != null
                    ? formatProductMoney(rule.sellAmountCents, productCurrency)
                    : extraPriceMessages.noAmount}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPricingExtraId(extra.id)}>
                  {extraPriceMessages.setPrice}
                </Button>
                {rule ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      remove.mutate(rule.id, { onSuccess: () => void rulesQuery.refetch() })
                    }
                  >
                    {extraPriceMessages.remove}
                  </Button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
      {pricingExtra ? (
        <ExtraPriceRuleDialog
          open={!!pricingExtra}
          onOpenChange={(open) => {
            if (!open) setPricingExtraId(null)
          }}
          optionPriceRuleId={optionPriceRuleId}
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
  const messages = useAdminMessages()
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

function formatProductMoney(amountCents: number | null | undefined, currency: string) {
  if (amountCents == null) return "-"
  return `${(amountCents / 100).toFixed(2)} ${currency}`
}
