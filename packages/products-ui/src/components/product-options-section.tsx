"use client"

import { useDuplicateOptionPricingMutation } from "@voyantjs/pricing-react"
import {
  type OptionUnitRecord,
  type ProductOptionRecord,
  useDuplicateProductOptionMutation,
  useOptionUnitMutation,
  useOptionUnits,
  useProductOptionMutation,
  useProductOptions,
} from "@voyantjs/products-react"
import { Badge } from "@voyantjs/voyant-ui/components/badge"
import { Button } from "@voyantjs/voyant-ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyantjs/voyant-ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/voyant-ui/components/table"
import { ChevronDown, ChevronRight, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { OptionUnitDialog } from "./option-unit-dialog"
import { ProductOptionDialog } from "./product-option-dialog"

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

export interface ProductOptionsSectionProps {
  productId: string
  pageSize?: number
  title?: string
  description?: string
  renderOptionDetails?: (option: ProductOptionRecord) => React.ReactNode
}

export function ProductOptionsSection({
  productId,
  pageSize = 100,
  title = "Options and units",
  description = "Manage option variants and the units available under each option.",
  renderOptionDetails,
}: ProductOptionsSectionProps) {
  const [expandedOptionId, setExpandedOptionId] = React.useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingOption, setEditingOption] = React.useState<ProductOptionRecord | undefined>(
    undefined,
  )

  const { data, isPending, isError } = useProductOptions({
    productId,
    limit: pageSize,
  })
  const { remove } = useProductOptionMutation()
  const duplicateOption = useDuplicateProductOptionMutation()
  const duplicatePricing = useDuplicateOptionPricingMutation()

  const options = React.useMemo(
    () => (data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [data?.data],
  )
  const nextSortOrder =
    options.length > 0 ? Math.max(...options.map((option) => option.sortOrder)) + 1 : 0

  return (
    <Card data-slot="product-options-section">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button
          onClick={() => {
            setEditingOption(undefined)
            setDialogOpen(true)
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
              expanded={expandedOptionId === option.id}
              onToggle={() =>
                setExpandedOptionId((current) => (current === option.id ? null : option.id))
              }
              onEdit={() => {
                setEditingOption(option)
                setDialogOpen(true)
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
                  remove.mutate(option.id)
                }
              }}
            >
              {renderOptionDetails?.(option)}
            </OptionRow>
          ))
        )}

        <ProductOptionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          productId={productId}
          option={editingOption}
          sortOrder={nextSortOrder}
          onSuccess={() => {
            setDialogOpen(false)
            setEditingOption(undefined)
          }}
        />
      </CardContent>
    </Card>
  )
}

function OptionRow({
  option,
  expanded,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  children,
}: React.PropsWithChildren<{
  option: ProductOptionRecord
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}>) {
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
          {option.code ? (
            <span className="font-mono text-xs text-muted-foreground">{option.code}</span>
          ) : null}
          <Badge variant={optionStatusVariant[option.status] ?? "outline"} className="capitalize">
            {option.status}
          </Badge>
          {option.isDefault ? <Badge variant="secondary">Default</Badge> : null}
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

      {expanded ? (
        <div className="flex flex-col gap-4 border-t bg-muted/30 p-3">
          <UnitsPanel optionId={option.id} />
          {children}
        </div>
      ) : null}
    </div>
  )
}

function UnitsPanel({ optionId }: { optionId: string }) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingUnit, setEditingUnit] = React.useState<OptionUnitRecord | undefined>(undefined)
  const { data, isPending, isError } = useOptionUnits({ optionId, limit: 100 })
  const { remove } = useOptionUnitMutation()

  const units = React.useMemo(
    () => (data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [data?.data],
  )
  const nextSortOrder = units.length > 0 ? Math.max(...units.map((unit) => unit.sortOrder)) + 1 : 0

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
            setEditingUnit(undefined)
            setDialogOpen(true)
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
                    <div className="font-medium">{unit.name}</div>
                    {unit.code ? (
                      <div className="font-mono text-xs text-muted-foreground">{unit.code}</div>
                    ) : null}
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
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditingUnit(unit)
                          setDialogOpen(true)
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

      <OptionUnitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        optionId={optionId}
        unit={editingUnit}
        sortOrder={nextSortOrder}
        onSuccess={() => {
          setDialogOpen(false)
          setEditingUnit(undefined)
        }}
      />
    </div>
  )
}
