import { useDuplicateOptionPricingMutation } from "@voyantjs/pricing-react"
import {
  useDuplicateProductOptionMutation,
  useOptionUnitMutation,
  useOptionUnits,
  useProductOptionMutation,
  useProductOptions,
} from "@voyantjs/products-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { ChevronDown, ChevronRight, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { OptionDialog } from "./product-option-dialog"
import { PricingPanel } from "./product-options-pricing"
import { UnitDialog } from "./product-unit-dialog"

const optionStatusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  active: "default",
  archived: "secondary",
}

function formatRange(min: number | null, max: number | null) {
  if (min == null && max == null) {
    return "—"
  }

  return `${min ?? 0}–${max ?? "∞"}`
}

export function OptionsSection({ productId }: { productId: string }) {
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null)
  const [optionDialogOpen, setOptionDialogOpen] = useState(false)
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null)
  const {
    data: optionsData,
    isPending,
    isError,
  } = useProductOptions({
    productId,
    limit: 100,
  })
  const { remove: removeOption } = useProductOptionMutation()
  const duplicateOption = useDuplicateProductOptionMutation()
  const duplicatePricing = useDuplicateOptionPricingMutation()
  const options = useMemo(
    () => (optionsData?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [optionsData?.data],
  )
  const nextSortOrder = options.length > 0 ? Math.max(...options.map((o) => o.sortOrder)) + 1 : 0
  const editingOption = useMemo(
    () => options.find((option) => option.id === editingOptionId),
    [editingOptionId, options],
  )

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Options and Units</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage option variants, selectable units, and option-level pricing.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingOptionId(null)
            setOptionDialogOpen(true)
          }}
        >
          <Plus className="mr-2 size-4" aria-hidden="true" />
          Add option
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isPending ? (
          <div className="flex min-h-24 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Failed to load product options.</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground">No options configured for this product.</p>
        ) : (
          options.map((option) => (
            <OptionRow
              key={option.id}
              option={option}
              productId={productId}
              expanded={expandedOptionId === option.id}
              onToggle={() =>
                setExpandedOptionId(expandedOptionId === option.id ? null : option.id)
              }
              onEdit={() => {
                setEditingOptionId(option.id)
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
                    },
                  },
                )
              }}
              onDelete={() => {
                if (confirm(`Delete option "${option.name}" and all its units?`)) {
                  removeOption.mutate(option.id)
                }
              }}
            />
          ))
        )}
      </CardContent>

      <OptionDialog
        open={optionDialogOpen}
        onOpenChange={setOptionDialogOpen}
        productId={productId}
        option={editingOption}
        nextSortOrder={nextSortOrder}
        onSuccess={() => {
          setOptionDialogOpen(false)
          setEditingOptionId(null)
        }}
      />
    </Card>
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
  option: NonNullable<ReturnType<typeof useProductOptions>["data"]>["data"][number]
  productId: string
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{option.name}</span>
          {option.code && (
            <span className="font-mono text-xs text-muted-foreground">{option.code}</span>
          )}
          <Badge variant={optionStatusVariant[option.status] ?? "outline"} className="capitalize">
            {option.status}
          </Badge>
          {option.isDefault && <Badge variant="secondary">Default</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onDuplicate}>
            <Copy className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 border-t bg-muted/30 p-3">
          <UnitsPanel optionId={option.id} />
          <PricingPanel productId={productId} optionId={option.id} />
        </div>
      )}
    </div>
  )
}

function UnitsPanel({ optionId }: { optionId: string }) {
  const [unitDialogOpen, setUnitDialogOpen] = useState(false)
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null)

  const { data, isPending, isError } = useOptionUnits({ optionId, limit: 100 })
  const { remove } = useOptionUnitMutation()
  const units = useMemo(
    () => (data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [data?.data],
  )
  const nextSort = units.length > 0 ? Math.max(...units.map((u) => u.sortOrder)) + 1 : 0
  const editingUnit = useMemo(
    () => units.find((unit) => unit.id === editingUnitId),
    [editingUnitId, units],
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Units</p>
          <p className="text-xs text-muted-foreground">
            Configure the selectable units that belong to this option.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingUnitId(null)
            setUnitDialogOpen(true)
          }}
        >
          <Plus className="mr-2 size-3.5" aria-hidden="true" />
          Add unit
        </Button>
      </div>

      {isPending ? (
        <div className="flex min-h-20 items-center justify-center rounded-md border bg-background">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load option units.</p>
      ) : units.length === 0 ? (
        <p className="rounded-md border bg-background px-3 py-4 text-sm text-muted-foreground">
          No units configured for this option.
        </p>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Occupancy</TableHead>
                <TableHead className="w-[88px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {unit.unitType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {unit.name}
                    {unit.code && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {unit.code}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatRange(unit.minQuantity, unit.maxQuantity)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatRange(unit.minAge, unit.maxAge)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatRange(unit.occupancyMin, unit.occupancyMax)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditingUnitId(unit.id)
                          setUnitDialogOpen(true)
                        }}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (confirm(`Delete unit "${unit.name}"?`)) {
                            remove.mutate(unit.id)
                          }
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
          setEditingUnitId(null)
        }}
      />
    </div>
  )
}
