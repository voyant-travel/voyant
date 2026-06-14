"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Button,
  Input,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Switch,
} from "@voyantjs/ui/components"
import { Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useVoyantProductsContext } from "../../index.js"

import { useDeparturePriceOverrideMutation } from "./commerce-client.js"
import { useProductDetailApi, useProductDetailMessages } from "./host.js"
import {
  getDeparturePriceOverridesQueryOptions,
  getOptionUnitsQueryOptions,
  getPriceCatalogsQueryOptions,
} from "./product-options-shared.js"

interface UnitRow {
  unitId: string
  unitName: string
  sortOrder: number
  /** Existing override id, when present. */
  overrideId: string | null
  sellInput: string
  costInput: string
  active: boolean
  /** Did this row's inputs change since last save? */
  dirty: boolean
}

function centsToInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return ""
  return (value / 100).toFixed(2)
}

function inputToCents(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === "") return null
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

export function DeparturePricingOverrideDialog({
  open,
  onOpenChange,
  departureId,
  optionId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  departureId: string | null
  optionId: string | null
  onSuccess: () => void
}) {
  const messages = useProductDetailMessages()
  const productMessages = messages.products.core
  const productsClient = useVoyantProductsContext()
  const api = useProductDetailApi()
  const enabled = open && !!departureId && !!optionId

  const { data: unitsData } = useQuery({
    ...getOptionUnitsQueryOptions(productsClient, optionId ?? ""),
    enabled: enabled && !!optionId,
  })
  const { data: overridesData, refetch: refetchOverrides } = useQuery({
    ...getDeparturePriceOverridesQueryOptions(api, departureId ?? ""),
    enabled: enabled && !!departureId,
  })
  const { data: catalogsData } = useQuery({
    ...getPriceCatalogsQueryOptions(api),
    enabled,
  })
  const { create, update, remove } = useDeparturePriceOverrideMutation()

  const catalog =
    catalogsData?.data.find((c) => c.catalogType === "public" && c.isDefault) ??
    catalogsData?.data.find((c) => c.catalogType === "public") ??
    null

  const [rows, setRows] = useState<UnitRow[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const units = (unitsData?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
    const overrides = overridesData?.data ?? []
    const next: UnitRow[] = units.map((unit) => {
      const existing = overrides.find((o) => o.optionUnitId === unit.id) ?? null
      return {
        unitId: unit.id,
        unitName: unit.name,
        sortOrder: unit.sortOrder,
        overrideId: existing?.id ?? null,
        sellInput: existing ? centsToInput(existing.sellAmountCents) : "",
        costInput: existing ? centsToInput(existing.costAmountCents) : "",
        active: existing ? existing.active : true,
        dirty: false,
      }
    })
    setRows(next)
  }, [open, unitsData, overridesData])

  if (!enabled) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{productMessages.departureOverrideTitle}</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    )
  }

  const updateRow = (unitId: string, patch: Partial<UnitRow>) => {
    setRows((prev) => prev.map((r) => (r.unitId === unitId ? { ...r, ...patch, dirty: true } : r)))
  }

  const handleSave = async () => {
    if (!catalog || !departureId || !optionId) return
    setSaving(true)
    try {
      for (const row of rows) {
        const sellCents = inputToCents(row.sellInput)
        const costCents = inputToCents(row.costInput)
        if (row.overrideId && sellCents === null) {
          await remove.mutateAsync(row.overrideId)
          continue
        }
        if (sellCents === null) continue
        if (row.overrideId) {
          if (!row.dirty) continue
          await update.mutateAsync({
            id: row.overrideId,
            input: {
              sellAmountCents: sellCents,
              costAmountCents: costCents,
              active: row.active,
            },
          })
        } else {
          await create.mutateAsync({
            departureId,
            optionId,
            optionUnitId: row.unitId,
            priceCatalogId: catalog.id,
            sellAmountCents: sellCents,
            costAmountCents: costCents,
            active: row.active,
          })
        }
      }
      await refetchOverrides()
      onSuccess()
    } finally {
      setSaving(false)
    }
  }

  const handleClearRow = (unitId: string) => {
    updateRow(unitId, { sellInput: "", costInput: "" })
  }

  const noUnits = rows.length === 0
  const noCatalog = !catalog

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{productMessages.departureOverrideTitle}</SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {productMessages.departureOverrideDescription}
          </p>

          {noCatalog ? (
            <p className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {productMessages.departureOverrideNoCatalog}
            </p>
          ) : null}

          {noUnits ? (
            <p className="rounded border bg-muted/30 p-3 text-xs text-muted-foreground">
              {productMessages.departureOverrideNoUnits}
            </p>
          ) : (
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left font-medium">
                      {productMessages.departureOverrideUnitColumn}
                    </th>
                    <th className="p-2 text-left font-medium">
                      {productMessages.departureOverrideSellColumn}
                    </th>
                    <th className="p-2 text-left font-medium">
                      {productMessages.departureOverrideCostColumn}
                    </th>
                    <th className="p-2 text-left font-medium">
                      {productMessages.departureOverrideActiveColumn}
                    </th>
                    <th className="w-10 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.unitId} className="border-b last:border-b-0">
                      <td className="p-2 font-medium">{row.unitName}</td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          value={row.sellInput}
                          onChange={(e) => updateRow(row.unitId, { sellInput: e.target.value })}
                          className="h-8 w-28"
                          disabled={noCatalog}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          value={row.costInput}
                          onChange={(e) => updateRow(row.unitId, { costInput: e.target.value })}
                          className="h-8 w-28"
                          disabled={noCatalog}
                        />
                      </td>
                      <td className="p-2">
                        <Switch
                          checked={row.active}
                          onCheckedChange={(active) => updateRow(row.unitId, { active })}
                          disabled={noCatalog}
                        />
                      </td>
                      <td className="p-2">
                        {row.sellInput ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleClearRow(row.unitId)}
                            aria-label={productMessages.departureOverrideClear}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={noUnits || noCatalog || saving}>
              {productMessages.departureOverrideSave}
            </Button>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
