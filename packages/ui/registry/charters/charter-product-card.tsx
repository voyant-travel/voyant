"use client"

import type { CharterProductRecord } from "@voyantjs/charters-react"
import { formatMessage } from "@voyantjs/i18n"
import { Anchor, Calendar, Sailboat } from "lucide-react"
import type * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import { ExternalCharterBadge } from "./external-badge"
import { useRegistryChartersI18nOrDefault } from "./i18n"

/** Lighter shape for the public-list / external-summary case. */
export interface CharterProductSummary {
  id?: string
  slug: string
  name: string
  lineName?: string | null
  yachtName?: string | null
  earliestVoyage?: string | null
  latestVoyage?: string | null
  /**
   * Lowest published per-suite price for the deployment's chosen browse
   * currency. Stored alongside `lowestPriceCurrency` so the card can
   * format with the right symbol.
   */
  lowestPriceAmount?: string | null
  lowestPriceCurrency?: string | null
  heroImageUrl?: string | null
  regions?: string[] | null
  themes?: string[] | null
}

export interface CharterProductCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  /**
   * Either the full local record or a summary shape (works for adapter-sourced
   * external products too — the field set is intentionally compatible).
   */
  product: CharterProductRecord | CharterProductSummary
  /** Set when rendering an adapter-sourced product so the badge appears. */
  sourceProvider?: string | null
  onSelect?: (product: CharterProductRecord | CharterProductSummary) => void
}

function getLowestPrice(
  product: CharterProductCardProps["product"],
): { amount: string; currency: string } | null {
  // Summary shape (adapter / public list).
  if ("lowestPriceAmount" in product && product.lowestPriceAmount) {
    return {
      amount: product.lowestPriceAmount,
      currency: product.lowestPriceCurrency ?? "USD",
    }
  }
  // Full record shape (local).
  if ("lowestPriceCachedAmount" in product && product.lowestPriceCachedAmount) {
    return {
      amount: product.lowestPriceCachedAmount,
      currency: product.lowestPriceCachedCurrency ?? "USD",
    }
  }
  return null
}

function getEarliestVoyage(product: CharterProductCardProps["product"]): string | null {
  if ("earliestVoyage" in product && product.earliestVoyage !== undefined)
    return product.earliestVoyage ?? null
  if ("earliestVoyageCached" in product) return product.earliestVoyageCached ?? null
  return null
}

/**
 * Display card for a charter product summary — works for both self-managed and
 * external (adapter-sourced) entries. The provenance badge appears when
 * `sourceProvider` is set so operators can tell at a glance which inventory
 * comes from upstream.
 */
export function CharterProductCard({
  product,
  sourceProvider,
  onSelect,
  className,
  ...props
}: CharterProductCardProps) {
  const i18n = useRegistryChartersI18nOrDefault()
  const m = i18n.messages.charterProductCard
  const yachtName = "yachtName" in product ? (product.yachtName ?? null) : null
  const lineName = "lineName" in product ? (product.lineName ?? null) : null
  const lowest = getLowestPrice(product)
  const earliest = getEarliestVoyage(product)

  return (
    <Card
      data-slot="charter-product-card"
      className={cn("overflow-hidden transition-shadow hover:shadow-md", className)}
      onClick={onSelect ? () => onSelect(product) : undefined}
      {...props}
    >
      {product.heroImageUrl ? (
        <div
          data-slot="charter-product-card-hero"
          className="aspect-[16/9] w-full bg-muted bg-cover bg-center"
          style={{ backgroundImage: `url(${product.heroImageUrl})` }}
          role="img"
          aria-label={product.name}
        />
      ) : null}
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {lineName ? (
            <Badge data-slot="charter-product-card-line" variant="secondary">
              {lineName}
            </Badge>
          ) : null}
          {sourceProvider ? <ExternalCharterBadge sourceProvider={sourceProvider} /> : null}
        </div>
        <h3 className="text-lg font-semibold leading-tight">{product.name}</h3>
        {yachtName ? (
          <p className="text-sm text-muted-foreground">
            <Sailboat
              aria-hidden="true"
              className="mr-1 inline size-4 shrink-0 align-text-bottom"
            />
            {yachtName}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {product.regions && product.regions.length > 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Anchor aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{product.regions.join(", ")}</span>
          </div>
        ) : null}
        {earliest ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar aria-hidden="true" className="size-4 shrink-0" />
            <span>{formatMessage(m.departurePrefix, { date: earliest })}</span>
          </div>
        ) : null}
        <div className="pt-2 text-base font-semibold">
          {formatLowestPrice(lowest, {
            pricingOnRequest: m.pricingOnRequest,
            fallbackCurrencyAmount: m.fallbackCurrencyAmount,
            formatCurrency: i18n.formatCurrency,
          })}
          {lowest ? (
            <span className="text-xs font-normal text-muted-foreground">
              {" "}
              {m.priceFromSuiteSuffix}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function formatLowestPrice(
  lowest: { amount: string; currency: string } | null,
  options: {
    pricingOnRequest: string
    fallbackCurrencyAmount: string
    formatCurrency: (
      value: number | string | bigint,
      currency: string,
      formatOptions?: Omit<Intl.NumberFormatOptions, "currency" | "style">,
    ) => string
  },
) {
  if (!lowest) return options.pricingOnRequest
  const value = Number(lowest.amount)
  if (!Number.isFinite(value)) {
    return formatMessage(options.fallbackCurrencyAmount, {
      amount: lowest.amount,
      currency: lowest.currency,
    })
  }
  return options.formatCurrency(value, lowest.currency, { maximumFractionDigits: 0 })
}
