"use client"

import { useQueries } from "@tanstack/react-query"
import { type ProductExtraRecord, useProductExtras } from "@voyantjs/extras-react"
import { getExtraPriceRulesQueryOptions, useVoyantPricingContext } from "@voyantjs/pricing-react"
import { Button, Label } from "@voyantjs/ui/components"
import { useBookingsUiI18nOrDefault } from "../i18n/provider.js"
import type { BookingCreateExtraLineInput } from "../index.js"

export function ProductExtrasPickerSection({
  productId,
  optionId,
  currency,
  travelerCount,
  value,
  onChange,
  enabled,
  labels,
}: {
  productId: string
  optionId: string | null
  currency: string
  travelerCount: number
  value: BookingCreateExtraLineInput[]
  onChange: (value: BookingCreateExtraLineInput[]) => void
  enabled: boolean
  labels: {
    heading: string
    empty: string
    included: string
    onRequest: string
    perPerson: string
  }
}) {
  const { formatCurrency } = useBookingsUiI18nOrDefault()
  const pricingClient = useVoyantPricingContext()
  const extrasQuery = useProductExtras({
    productId,
    active: true,
    limit: 100,
    enabled: enabled && Boolean(productId),
  })
  const extras = extrasQuery.data?.data ?? []
  const priceQueries = useQueries({
    queries: extras.map((extra) => ({
      ...getExtraPriceRulesQueryOptions(pricingClient, {
        productExtraId: extra.id,
        ...(optionId ? { optionId } : {}),
        active: true,
        limit: 10,
      }),
      enabled,
    })),
  })
  const priceByExtraId = new Map(
    extras.flatMap((extra, index) => {
      const row = priceQueries[index]?.data?.data?.[0]
      return row ? ([[extra.id, row]] as const) : []
    }),
  )
  const selectedByExtraId = new Map(value.map((line) => [line.productExtraId, line]))

  const setQuantity = (extra: ProductExtraRecord, quantity: number) => {
    const next = value.filter((line) => line.productExtraId !== extra.id)
    if (quantity > 0) {
      const price = priceByExtraId.get(extra.id)
      const pricingMode =
        price?.pricingMode ?? (extra.pricedPerPerson ? "per_person" : extra.pricingMode)
      const unitSellAmountCents = price?.sellAmountCents ?? null
      const chargedQuantity =
        pricingMode === "per_person" || extra.pricedPerPerson
          ? Math.max(1, travelerCount) * quantity
          : quantity
      const totalSellAmountCents =
        unitSellAmountCents == null ? null : unitSellAmountCents * chargedQuantity
      next.push({
        productExtraId: extra.id,
        name: extra.name,
        description: extra.description,
        pricingMode,
        pricedPerPerson: extra.pricedPerPerson,
        quantity,
        sellCurrency: currency,
        unitSellAmountCents,
        totalSellAmountCents,
      })
    }
    onChange(next)
  }

  if (extras.length === 0 && extrasQuery.isSuccess) {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <Label>{labels.heading}</Label>
        <p className="text-xs text-muted-foreground">{labels.empty}</p>
      </div>
    )
  }

  if (extras.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <Label>{labels.heading}</Label>
      <div className="flex flex-col gap-2">
        {extras.map((extra) => {
          const selected = selectedByExtraId.get(extra.id)
          const quantity = selected?.quantity ?? 0
          const price = priceByExtraId.get(extra.id)
          const pricingMode =
            price?.pricingMode ?? (extra.pricedPerPerson ? "per_person" : extra.pricingMode)
          const unitAmount = price?.sellAmountCents ?? null
          const priceLabel =
            pricingMode === "included" || pricingMode === "free"
              ? labels.included
              : unitAmount == null
                ? labels.onRequest
                : `${formatCurrency(unitAmount / 100, currency)}${
                    pricingMode === "per_person" || extra.pricedPerPerson
                      ? ` ${labels.perPerson}`
                      : ""
                  }`
          const maxQuantity = extra.maxQuantity ?? undefined
          return (
            <div key={extra.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{extra.name}</div>
                <div className="text-xs text-muted-foreground">{priceLabel}</div>
              </div>
              <QuantityButtons
                value={quantity}
                max={maxQuantity}
                onChange={(next) => setQuantity(extra, next)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuantityButtons({
  value,
  max,
  onChange,
}: {
  value: number
  max?: number
  onChange(value: number): void
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        disabled={value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        -
      </Button>
      <span className="min-w-6 text-center text-sm tabular-nums">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        disabled={max != null && value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </Button>
    </div>
  )
}
