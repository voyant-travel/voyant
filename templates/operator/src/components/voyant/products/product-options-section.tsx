import { useMutation, useQuery } from "@tanstack/react-query"
import { formatMessage } from "@voyantjs/admin"
import { useDuplicateOptionPricingMutation } from "@voyantjs/pricing-react"
import {
  useDuplicateProductOptionMutation,
  useOptionUnitMutation,
  useProductOptionMutation,
} from "@voyantjs/products-react"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voyantjs/ui/components"
import { Separator } from "@voyantjs/ui/components/separator"
import { ChevronDown, ChevronRight, Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { OptionDialog, type ProductOptionData } from "./product-option-dialog"
import { PricingPanel } from "./product-options-pricing"
import {
  getOptionUnitsQueryOptions,
  getProductOptionsQueryOptions,
  optionStatusVariant,
} from "./product-options-shared"
import { type OptionUnitData, UnitDialog } from "./product-unit-dialog"

function getOptionStatusLabel(
  status: ProductOptionData["status"],
  messages: ReturnType<typeof useAdminMessages>["products"]["operations"]["options"],
) {
  switch (status) {
    case "draft":
      return messages.statusDraft
    case "active":
      return messages.statusActive
    case "archived":
      return messages.statusArchived
    default:
      return status
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

export function OptionsSection({ productId }: { productId: string }) {
  const messages = useAdminMessages()
  const optionMessages = messages.products.operations.options
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null)
  const [optionDialogOpen, setOptionDialogOpen] = useState(false)
  const [editingOption, setEditingOption] = useState<ProductOptionData | undefined>()

  const { data: optionsData, refetch: refetchOptions } = useQuery(
    getProductOptionsQueryOptions(productId),
  )
  const { remove: removeOption } = useProductOptionMutation()
  const duplicateOption = useDuplicateProductOptionMutation()
  const duplicatePricing = useDuplicateOptionPricingMutation()

  const deleteOptionMutation = useMutation({
    mutationFn: (optionId: string) => removeOption.mutateAsync(optionId),
    onSuccess: () => void refetchOptions(),
  })

  const options = (optionsData?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
  const nextSortOrder = options.length > 0 ? Math.max(...options.map((o) => o.sortOrder)) + 1 : 0

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="font-semibold leading-none tracking-tight">{optionMessages.sectionTitle}</h2>
        <ActionMenu>
          <DropdownMenuItem
            onClick={() => {
              setEditingOption(undefined)
              setOptionDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            {optionMessages.addAction}
          </DropdownMenuItem>
        </ActionMenu>
      </div>
      <Separator />
      <div className="px-6 py-4">
        {options.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{optionMessages.empty}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {options.map((option) => (
              <OptionRow
                key={option.id}
                option={option}
                productId={productId}
                expanded={expandedOptionId === option.id}
                onToggle={() =>
                  setExpandedOptionId(expandedOptionId === option.id ? null : option.id)
                }
                onEdit={() => {
                  setEditingOption(option)
                  setOptionDialogOpen(true)
                }}
                onDuplicate={() => {
                  duplicateOption.mutate(
                    { sourceOptionId: option.id, productId },
                    {
                      onSuccess: async ({ option: duplicatedOption, unitIdMap }) => {
                        await duplicatePricing.mutateAsync({
                          sourceOptionId: option.id,
                          targetOptionId: duplicatedOption.id,
                          productId,
                          unitIdMap,
                        })
                        await refetchOptions()
                      },
                    },
                  )
                }}
                onDelete={() => {
                  if (confirm(formatMessage(optionMessages.deleteConfirm, { name: option.name }))) {
                    deleteOptionMutation.mutate(option.id)
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      <OptionDialog
        open={optionDialogOpen}
        onOpenChange={setOptionDialogOpen}
        productId={productId}
        option={editingOption}
        nextSortOrder={nextSortOrder}
        onSuccess={() => {
          setOptionDialogOpen(false)
          setEditingOption(undefined)
          void refetchOptions()
        }}
      />
    </div>
  )
}

function OptionRow({
  option,
  productId,
  expanded,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  option: ProductOptionData
  productId: string
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const messages = useAdminMessages()
  const optionMessages = messages.products.operations.options
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex flex-1 items-center gap-2">
          <span className="text-sm font-medium">{option.name}</span>
          {option.code && (
            <span className="font-mono text-xs text-muted-foreground">{option.code}</span>
          )}
          <Badge variant={optionStatusVariant[option.status] ?? "outline"} className="capitalize">
            {getOptionStatusLabel(option.status, optionMessages)}
          </Badge>
          {option.isDefault && <Badge variant="secondary">{optionMessages.defaultBadge}</Badge>}
        </div>
        <ActionMenu>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            {optionMessages.editAction}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            {optionMessages.deleteAction}
          </DropdownMenuItem>
        </ActionMenu>
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 border-t p-4">
          <UnitsPanel optionId={option.id} />
          <PricingPanel productId={productId} optionId={option.id} />
        </div>
      )}
    </div>
  )
}

function UnitsPanel({ optionId }: { optionId: string }) {
  const messages = useAdminMessages()
  const unitMessages = messages.products.operations.units
  const [unitDialogOpen, setUnitDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<OptionUnitData | undefined>()

  const { data, refetch } = useQuery(getOptionUnitsQueryOptions(optionId))
  const { remove } = useOptionUnitMutation()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove.mutateAsync(id),
    onSuccess: () => void refetch(),
  })

  const units = (data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
  const nextSort = units.length > 0 ? Math.max(...units.map((u) => u.sortOrder)) + 1 : 0

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {unitMessages.sectionTitle}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingUnit(undefined)
            setUnitDialogOpen(true)
          }}
        >
          <Plus className="mr-1 h-3 w-3" />
          {unitMessages.addAction}
        </Button>
      </div>

      {units.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">{unitMessages.empty}</p>
      ) : (
        <div className="rounded border bg-background">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-2 text-left font-medium">{unitMessages.tableType}</th>
                <th className="p-2 text-left font-medium">{unitMessages.tableName}</th>
                <th className="p-2 text-left font-medium">{unitMessages.tableQuantity}</th>
                <th className="p-2 text-left font-medium">{unitMessages.tableAge}</th>
                <th className="p-2 text-left font-medium">{unitMessages.tableOccupancy}</th>
                <th className="w-10 p-2" />
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="border-b last:border-b-0">
                  <td className="p-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {getUnitTypeLabel(unit.unitType, unitMessages)}
                    </Badge>
                  </td>
                  <td className="p-2">
                    {unit.name}
                    {unit.code && (
                      <span className="ml-2 font-mono text-muted-foreground">{unit.code}</span>
                    )}
                  </td>
                  <td className="p-2 font-mono">
                    {unit.minQuantity ?? 0}–{unit.maxQuantity ?? "∞"}
                  </td>
                  <td className="p-2 font-mono">
                    {unit.minAge != null || unit.maxAge != null
                      ? `${unit.minAge ?? 0}–${unit.maxAge ?? "∞"}`
                      : "-"}
                  </td>
                  <td className="p-2 font-mono">
                    {unit.occupancyMin != null || unit.occupancyMax != null
                      ? `${unit.occupancyMin ?? 0}–${unit.occupancyMax ?? "∞"}`
                      : "-"}
                  </td>
                  <td className="p-2">
                    <ActionMenu>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingUnit(unit)
                          setUnitDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        {unitMessages.editAction}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          if (
                            confirm(formatMessage(unitMessages.deleteConfirm, { name: unit.name }))
                          ) {
                            deleteMutation.mutate(unit.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        {unitMessages.deleteAction}
                      </DropdownMenuItem>
                    </ActionMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UnitDialog
        open={unitDialogOpen}
        onOpenChange={setUnitDialogOpen}
        optionId={optionId}
        unit={editingUnit}
        nextSortOrder={nextSort}
        onSuccess={() => {
          setUnitDialogOpen(false)
          setEditingUnit(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
