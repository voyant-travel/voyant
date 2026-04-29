"use client"

import { usePricingPreview } from "@voyantjs/bookings-react"
import { Label } from "@voyantjs/ui/components"
import * as React from "react"
import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider"

export interface PriceBreakdownLine {
  unitId: string
  label: string
  quantity: number
  /** Per-unit price for the matched tier/row. `null` = on-request pricing. */
  unitAmountCents: number | null
  /** `unitAmountCents * quantity` or null when on-request. */
  totalAmountCents: number | null
  /**
   * Populated when a non-default tier matched — operator-visible "N × 100 EUR
   * — group rate" kind of hint. Null for the default tier / single-price row.
   */
  tierLabel: string | null
  isGroupRate: boolean
}

export interface PriceBreakdownSectionProps {
  productId?: string
  optionId?: string | null
  /** Quantity per option_unit id, typically from RoomsStepperSection. */
  unitQuantities: Record<string, number>
  /**
   * Force a specific catalog. Defaults to the public catalog the storefront
   * uses — matches what a customer would see.
   */
  catalogId?: string | null
  labels?: {
    heading?: string
    total?: string
    onRequest?: string
    groupRate?: string
    empty?: string
    noPricing?: string
  }
}

interface TierRow {
  minQuantity: number
  maxQuantity: number | null
  sellAmountCents: number | null
}

/**
 * Picks the tier whose quantity range contains `qty`. Tiers are expected
 * oldest-to-newest, `minQuantity`-ascending. Ties are broken by first-match —
 * the server sorts by sort_order and then min_quantity, so the selection here
 * mirrors the storefront engine.
 */
function matchTier(tiers: ReadonlyArray<TierRow>, qty: number): TierRow | null {
  for (const tier of tiers) {
    if (
      qty >= tier.minQuantity &&
      (tier.maxQuantity === null || qty <= tier.maxQuantity) // i18n-literal-ok numeric bounds
    ) {
      return tier
    }
  }
  return null
}

/**
 * Live price-breakdown preview for booking-create flows. Read-only — uses
 * `usePricingPreview` (#237) to fetch the catalog-resolved snapshot the
 * storefront also uses, then computes lines against the operator's current
 * unit quantities so the operator sees the same numbers the customer would.
 *
 * ### Pricing mode handling
 *
 * - `per_unit` — multiply the matched tier's `sellAmountCents` by quantity.
 * - `free` / `included` — render 0.00 without an on-request badge.
 * - `on_request` / anything else — render "On request"; total excludes it.
 */
export function PriceBreakdownSection({
  productId,
  optionId,
  unitQuantities,
  catalogId,
  labels,
}: PriceBreakdownSectionProps) {
  const { formatCurrency, formatNumber } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()
  const merged = { ...messages.priceBreakdownSection.labels, ...labels }
  const preview = usePricingPreview({
    productId: productId ?? "",
    optionId: optionId ?? null,
    catalogId: catalogId ?? null,
    enabled: Boolean(productId),
  })

  const snapshot = preview.data?.data
  const currency = snapshot?.catalog.currencyCode ?? null
  const formatAmount = React.useCallback(
    (cents: number) =>
      currency
        ? formatCurrency(cents / 100, currency)
        : formatNumber(cents / 100, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
    [currency, formatCurrency, formatNumber],
  )

  const { lines, total } = React.useMemo(() => {
    const out: PriceBreakdownLine[] = []
    let runningTotal = 0
    let anyOnRequest = false

    if (!snapshot) return { lines: out, total: null as number | null }

    // Pick the default price rule for the resolved option (snapshot already
    // filters options by the caller's optionId; rules keep isDefault-first
    // ordering from the server).
    const rulesByOption = new Map<string, (typeof snapshot.rules)[number][]>()
    for (const rule of snapshot.rules) {
      const existing = rulesByOption.get(rule.optionId) ?? []
      existing.push(rule)
      rulesByOption.set(rule.optionId, existing)
    }

    const unitPricesByUnit = new Map<string, (typeof snapshot.unitPrices)[number]>()
    for (const up of snapshot.unitPrices) {
      if (!unitPricesByUnit.has(up.unitId)) {
        unitPricesByUnit.set(up.unitId, up)
      }
    }

    for (const [unitId, quantity] of Object.entries(unitQuantities)) {
      if (quantity <= 0) continue
      const up = unitPricesByUnit.get(unitId)
      if (!up) {
        // The unit isn't priced in this catalog — show it on-request so the
        // operator knows they need to quote manually.
        out.push({
          unitId,
          label: unitId,
          quantity,
          unitAmountCents: null,
          totalAmountCents: null,
          tierLabel: null,
          isGroupRate: false,
        })
        anyOnRequest = true
        continue
      }

      const label = up.unitName || unitId

      if (up.pricingMode === "on_request") {
        out.push({
          unitId,
          label,
          quantity,
          unitAmountCents: null,
          totalAmountCents: null,
          tierLabel: merged.onRequest,
          isGroupRate: false,
        })
        anyOnRequest = true
        continue
      }

      if (up.pricingMode === "free" || up.pricingMode === "included") {
        out.push({
          unitId,
          label,
          quantity,
          unitAmountCents: 0,
          totalAmountCents: 0,
          tierLabel: null,
          isGroupRate: false,
        })
        continue
      }

      // per_unit (and anything else that falls through to explicit amounts).
      const matchedTier = matchTier(up.tiers, quantity)
      const unitAmount = matchedTier?.sellAmountCents ?? up.sellAmountCents
      if (unitAmount === null) {
        out.push({
          unitId,
          label,
          quantity,
          unitAmountCents: null,
          totalAmountCents: null,
          tierLabel: merged.onRequest,
          isGroupRate: false,
        })
        anyOnRequest = true
        continue
      }

      const lineTotal = unitAmount * quantity
      const isGroupRate = matchedTier !== null && matchedTier.minQuantity > 1
      out.push({
        unitId,
        label,
        quantity,
        unitAmountCents: unitAmount,
        totalAmountCents: lineTotal,
        tierLabel: isGroupRate ? merged.groupRate : null,
        isGroupRate,
      })
      runningTotal += lineTotal
    }

    return { lines: out, total: anyOnRequest ? null : runningTotal }
  }, [snapshot, unitQuantities, merged.onRequest, merged.groupRate])

  // Empty states
  if (!productId) return null
  if (preview.isError || (preview.isSuccess && !snapshot)) {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <Label>{merged.heading}</Label>
        <p className="text-xs text-muted-foreground">{merged.noPricing}</p>
      </div>
    )
  }
  if (lines.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <Label>{merged.heading}</Label>
        <p className="text-xs text-muted-foreground">{merged.empty}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <Label>{merged.heading}</Label>
      <div className="flex flex-col gap-1.5">
        {lines.map((line) => (
          <div key={line.unitId} className="flex items-baseline justify-between text-sm">
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums">{formatNumber(line.quantity)}x</span>
              <span>{line.label}</span>
              {line.tierLabel ? (
                <span className="text-xs text-muted-foreground">· {line.tierLabel}</span>
              ) : null}
            </div>
            <div className="tabular-nums">
              {line.totalAmountCents === null
                ? merged.onRequest
                : formatAmount(line.totalAmountCents)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-baseline justify-between border-t pt-2 text-sm font-medium">
        <span>{merged.total}</span>
        <span className="tabular-nums">
          {total === null ? merged.onRequest : formatAmount(total)}
        </span>
      </div>
    </div>
  )
}
