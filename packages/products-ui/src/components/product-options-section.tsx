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
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyantjs/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { ChevronDown, ChevronRight, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { useProductsUiMessagesOrDefault } from "../i18n/provider.js"
import { OptionUnitDialog } from "./option-unit-dialog.js"
import { ProductOptionDialog } from "./product-option-dialog.js"

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

function formatMessage(template: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

function formatInventory(
  unit: OptionUnitRecord,
  messages: ReturnType<typeof useProductsUiMessagesOrDefault>["productOptionsSection"],
) {
  if (unit.unitType === "room") {
    if (unit.maxQuantity != null && unit.maxQuantity > 0) {
      return formatMessage(messages.unitSummaries.roomsWithCount, { count: unit.maxQuantity })
    }
    return messages.unitSummaries.rooms
  }

  if (unit.unitType === "vehicle") {
    if (unit.maxQuantity != null && unit.maxQuantity > 0) {
      return formatMessage(messages.unitSummaries.vehiclesWithCount, { count: unit.maxQuantity })
    }
    return messages.unitSummaries.vehicles
  }

  return formatMessage(messages.unitSummaries.range, {
    range: formatRange(unit.minQuantity, unit.maxQuantity),
  })
}

function formatOccupancyText(
  unit: OptionUnitRecord,
  messages: ReturnType<typeof useProductsUiMessagesOrDefault>["productOptionsSection"],
) {
  if (unit.occupancyMin == null && unit.occupancyMax == null) {
    return "—"
  }

  if (unit.occupancyMin === unit.occupancyMax) {
    return formatMessage(messages.unitSummaries.sleeps, { count: unit.occupancyMin ?? 0 })
  }

  return formatMessage(messages.unitSummaries.sleepsRange, {
    range: `${unit.occupancyMin ?? 0}–${unit.occupancyMax ?? "∞"}`,
  })
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
  title,
  description,
  renderOptionDetails,
}: ProductOptionsSectionProps) {
  const messages = useProductsUiMessagesOrDefault()
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
  const resolvedTitle = title ?? messages.productOptionsSection.titles.default
  const resolvedDescription = description ?? messages.productOptionsSection.descriptions.default

  return (
    <Card data-slot="product-options-section">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle>{resolvedTitle}</CardTitle>
          <CardDescription>{resolvedDescription}</CardDescription>
        </div>
        <Button
          onClick={() => {
            setEditingOption(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 size-4" aria-hidden="true" />
          {messages.productOptionsSection.actions.addOption}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isPending ? (
          <div className="flex min-h-24 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            {messages.productOptionsSection.loadingError.options}
          </p>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {messages.productOptionsSection.empty.options}
          </p>
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
                if (
                  confirm(
                    messages.productOptionsSection.deleteConfirm.option.replace(
                      "{name}",
                      option.name,
                    ),
                  )
                ) {
                  remove.mutate(option.id)
                }
              }}
              messages={messages}
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
  messages,
  children,
}: React.PropsWithChildren<{
  option: ProductOptionRecord
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  messages: ReturnType<typeof useProductsUiMessagesOrDefault>
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
          <Badge variant={optionStatusVariant[option.status] ?? "outline"}>
            {
              messages.common.optionStatusLabels[
                option.status as keyof typeof messages.common.optionStatusLabels
              ]
            }
          </Badge>
          {option.isDefault ? (
            <Badge variant="secondary">{messages.productOptionsSection.badges.defaultOption}</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDuplicate}
            aria-label={messages.productOptionsSection.actions.duplicate}
          >
            <Copy className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            aria-label={messages.productOptionsSection.actions.edit}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label={messages.productOptionsSection.actions.delete}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="flex flex-col gap-4 border-t bg-muted/30 p-3">
          <UnitsPanel optionId={option.id} messages={messages} />
          {children}
        </div>
      ) : null}
    </div>
  )
}

function UnitsPanel({
  optionId,
  messages,
}: {
  optionId: string
  messages: ReturnType<typeof useProductsUiMessagesOrDefault>
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingUnit, setEditingUnit] = React.useState<OptionUnitRecord | undefined>(undefined)
  const { data, isPending, isError } = useOptionUnits({ optionId, limit: 100 })
  const { remove } = useOptionUnitMutation()

  const units = React.useMemo(
    () => (data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [data?.data],
  )
  const nextSortOrder = units.length > 0 ? Math.max(...units.map((unit) => unit.sortOrder)) + 1 : 0
  const isPersonOnly = units.length > 0 && units.every((unit) => unit.unitType === "person")
  const showAge = units.some((unit) => unit.unitType === "person")
  const hasRoomUnits = units.some((unit) => unit.unitType === "room")
  const showOccupancy = units.some(
    (unit) => unit.unitType === "room" || unit.occupancyMin != null || unit.occupancyMax != null,
  )
  const unitsTitle = isPersonOnly
    ? messages.productOptionsSection.titles.personUnits
    : hasRoomUnits
      ? messages.productOptionsSection.titles.roomUnits
      : messages.productOptionsSection.titles.units
  const unitsDescription = isPersonOnly
    ? messages.productOptionsSection.descriptions.personUnits
    : hasRoomUnits
      ? messages.productOptionsSection.descriptions.roomUnits
      : messages.productOptionsSection.descriptions.units
  const addUnitLabel = isPersonOnly
    ? messages.productOptionsSection.actions.addPersonUnit
    : hasRoomUnits
      ? messages.productOptionsSection.actions.addRoomUnit
      : messages.productOptionsSection.actions.addUnit
  const quantityColumnLabel = isPersonOnly
    ? messages.productOptionsSection.columns.personQuantity
    : hasRoomUnits
      ? messages.productOptionsSection.columns.roomQuantity
      : messages.productOptionsSection.columns.quantity

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {unitsTitle}
          </p>
          <p className="text-xs text-muted-foreground">{unitsDescription}</p>
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
          {addUnitLabel}
        </Button>
      </div>

      {isPending ? (
        <div className="flex min-h-20 items-center justify-center rounded-md border bg-background">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {messages.productOptionsSection.loadingError.units}
        </p>
      ) : units.length === 0 ? (
        <p className="rounded-md border bg-background px-3 py-4 text-sm text-muted-foreground">
          {messages.productOptionsSection.empty.units}
        </p>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.productOptionsSection.columns.unitType}</TableHead>
                <TableHead>{messages.productOptionsSection.columns.unitName}</TableHead>
                <TableHead>{quantityColumnLabel}</TableHead>
                {showAge ? (
                  <TableHead>{messages.productOptionsSection.columns.age}</TableHead>
                ) : null}
                {showOccupancy ? (
                  <TableHead>{messages.productOptionsSection.columns.occupancy}</TableHead>
                ) : null}
                <TableHead className="w-[88px] text-right">
                  {messages.productOptionsSection.columns.actions}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {messages.common.optionUnitTypeLabels[unit.unitType]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{unit.name}</div>
                    {unit.code ? (
                      <div className="font-mono text-xs text-muted-foreground">{unit.code}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      {formatInventory(unit, messages.productOptionsSection)}
                    </div>
                  </TableCell>
                  {showAge ? (
                    <TableCell className="font-mono text-xs">
                      {formatRange(unit.minAge, unit.maxAge)}
                    </TableCell>
                  ) : null}
                  {showOccupancy ? (
                    <TableCell>
                      <div className="text-xs">
                        {formatOccupancyText(unit, messages.productOptionsSection)}
                      </div>
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditingUnit(unit)
                          setDialogOpen(true)
                        }}
                        aria-label={messages.productOptionsSection.actions.edit}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (
                            confirm(
                              messages.productOptionsSection.deleteConfirm.unit.replace(
                                "{name}",
                                unit.name,
                              ),
                            )
                          ) {
                            remove.mutate(unit.id)
                          }
                        }}
                        aria-label={messages.productOptionsSection.actions.delete}
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
