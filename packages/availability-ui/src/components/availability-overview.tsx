"use client"

import type {
  AvailabilityPickupPointRow,
  AvailabilityRuleRow,
  AvailabilitySlotRow,
  ProductOption,
} from "@voyantjs/availability-react"
import { productNameById, slotLocalStart } from "@voyantjs/availability-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Input,
  OverviewMetric,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Package,
  Search,
  Truck,
} from "lucide-react"
import { useAvailabilityUiMessagesOrDefault } from "../i18n/index.js"
import { type AvailabilityColumnsMessages, getSlotStatusLabel } from "./availability-columns.js"

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    return value === undefined ? "" : String(value)
  })
}

export interface AvailabilityOverviewMessages extends AvailabilityColumnsMessages {
  allProducts: string
  clearFilters: string
  searchPlaceholder: string
  overview: {
    openSlotsTitle: string
    openSlotsDescription: string
    constrainedSlotsTitle: string
    constrainedSlotsDescription: string
    activeRulesTitle: string
    activeRulesDescription: string
    pickupPointsTitle: string
    pickupPointsDescription: string
    capacityWatchlistTitle: string
    capacityWatchlistEmpty: string
    coverageGapsTitle: string
    coverageGapsEmpty: string
    coverageGapDescription: string
    actionRequiredTitle: string
    actionRequiredBody: string
    actionRequiredCta: string
    attentionTitle: string
    attentionEmpty: string
    severityCoverageGap: string
    severityClosed: string
    severitySoldOut: string
  }
}

export function AvailabilityOverview({
  messages,
  products,
  constrainedSlots,
  constrainedSlotsCount: providedConstrainedSlotsCount,
  openSlotsCount: providedOpenSlotsCount,
  activeRulesCount: providedActiveRulesCount,
  activePickupPointsCount: providedActivePickupPointsCount,
  filteredRules,
  filteredPickupPoints,
  productsWithoutUpcomingDepartures,
  productsWithoutUpcomingDeparturesCount: providedProductsWithoutUpcomingDeparturesCount,
  search,
  setSearch,
  productFilter,
  setProductFilter,
  hasFilters,
  onClearFilters,
  onOpenSlot,
  onOpenProduct,
  onJumpToSlots,
  showFilters = true,
}: {
  messages: AvailabilityOverviewMessages
  products: ProductOption[]
  constrainedSlots: AvailabilitySlotRow[]
  constrainedSlotsCount?: number
  openSlotsCount?: number
  activeRulesCount?: number
  activePickupPointsCount?: number
  filteredRules: AvailabilityRuleRow[]
  filteredPickupPoints: AvailabilityPickupPointRow[]
  productsWithoutUpcomingDepartures: ProductOption[]
  productsWithoutUpcomingDeparturesCount?: number
  search: string
  setSearch: (value: string) => void
  productFilter: string
  setProductFilter: (value: string) => void
  hasFilters: boolean
  onClearFilters: () => void
  onOpenSlot: (slotId: string) => void
  onOpenProduct: (productId: string) => void
  onJumpToSlots?: () => void
  showFilters?: boolean
}) {
  useAvailabilityUiMessagesOrDefault()
  const openSlotsCount =
    providedOpenSlotsCount ?? constrainedSlots.filter((slot) => slot.status === "open").length
  const constrainedSlotsCount = providedConstrainedSlotsCount ?? constrainedSlots.length
  const activeRulesCount =
    providedActiveRulesCount ?? filteredRules.filter((rule) => rule.active).length
  const activePickupPointsCount =
    providedActivePickupPointsCount ??
    filteredPickupPoints.filter((pickupPoint) => pickupPoint.active).length

  const noDeparturesCount =
    providedProductsWithoutUpcomingDeparturesCount ?? productsWithoutUpcomingDepartures.length
  const hasNoDeparturesProducts = noDeparturesCount > 0
  const hasConstrainedSlots = constrainedSlotsCount > 0
  const hasAttention = hasNoDeparturesProducts || hasConstrainedSlots

  return (
    <>
      {/* Action banner — only when bookings can't open */}
      {hasNoDeparturesProducts ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <div className="font-medium">{messages.overview.actionRequiredTitle}</div>
              <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
                {interpolate(messages.overview.actionRequiredBody, { count: noDeparturesCount })}
              </p>
            </div>
          </div>
          {onJumpToSlots ? (
            <Button size="sm" className="self-start sm:self-auto" onClick={onJumpToSlots}>
              {messages.overview.actionRequiredCta}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* KPI strip */}
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <OverviewMetric
          title={messages.overview.openSlotsTitle}
          value={openSlotsCount}
          description={messages.overview.openSlotsDescription}
          icon={CalendarDays}
        />
        <OverviewMetric
          title={messages.overview.constrainedSlotsTitle}
          value={constrainedSlotsCount}
          description={messages.overview.constrainedSlotsDescription}
          icon={Clock3}
        />
        <OverviewMetric
          title={messages.overview.activeRulesTitle}
          value={activeRulesCount}
          description={messages.overview.activeRulesDescription}
          icon={Package}
        />
        <OverviewMetric
          title={messages.overview.pickupPointsTitle}
          value={activePickupPointsCount}
          description={messages.overview.pickupPointsDescription}
          icon={Truck}
        />
      </div>

      {/* Single unified attention panel */}
      <Card size="sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            {messages.overview.attentionTitle}
            {hasAttention ? (
              <Badge variant="secondary" className="tabular-nums">
                {noDeparturesCount + constrainedSlotsCount}
              </Badge>
            ) : null}
          </CardTitle>
          {!hasAttention ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              {messages.overview.attentionEmpty.split(".")[0]}
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {hasAttention ? (
            <>
              <AttentionColumn
                title={messages.overview.coverageGapsTitle}
                count={noDeparturesCount}
                items={productsWithoutUpcomingDepartures.slice(0, 4).map((product) => ({
                  id: product.id,
                  primary: product.name,
                  secondary: messages.overview.coverageGapDescription,
                  severityLabel: messages.overview.severityCoverageGap,
                  severityTone: "destructive" as const,
                  onClick: () => onOpenProduct(product.id),
                }))}
                emptyMessage={messages.overview.coverageGapsEmpty}
              />
              <AttentionColumn
                title={messages.overview.capacityWatchlistTitle}
                count={constrainedSlotsCount}
                items={constrainedSlots.slice(0, 4).map((slot) => ({
                  id: slot.id,
                  primary: `${productNameById(products, slot.productId, slot.productName)} · ${slot.dateLocal}`,
                  secondary: `${formatSlotLocalDateTime(slotLocalStart(slot))} · ${messages.remainingPaxLabel}: ${
                    slot.remainingPax ?? messages.details.noValue
                  }`,
                  severityLabel:
                    slot.status === "sold_out"
                      ? messages.overview.severitySoldOut
                      : slot.status === "closed"
                        ? messages.overview.severityClosed
                        : getSlotStatusLabel(slot.status, messages),
                  severityTone:
                    slot.status === "sold_out" ? ("default" as const) : ("outline" as const),
                  onClick: () => onOpenSlot(slot.id),
                }))}
                emptyMessage={messages.overview.capacityWatchlistEmpty}
              />
            </>
          ) : (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
              {messages.overview.attentionEmpty}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      {showFilters ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={messages.searchPlaceholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={productFilter}
              onValueChange={(value) => setProductFilter(value ?? "all")}
            >
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder={messages.allProducts} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{messages.allProducts}</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasFilters ? (
            <Button variant="outline" onClick={onClearFilters}>
              {messages.clearFilters}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

function formatSlotLocalDateTime(value: { date: string; time: string }) {
  return `${value.date} ${value.time}`
}

interface AttentionItem {
  id: string
  primary: string
  secondary: string
  severityLabel: string
  severityTone: "default" | "secondary" | "destructive" | "outline"
  onClick: () => void
}

function AttentionColumn({
  title,
  count,
  items,
  emptyMessage,
}: {
  title: string
  count: number
  items: AttentionItem[]
  emptyMessage: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {count > 0 ? (
          <Badge variant="outline" className="tabular-nums">
            {count}
          </Badge>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={item.onClick}
                className={cn(
                  "group flex w-full items-start justify-between gap-3 rounded-md border bg-card px-3 py-2 text-left transition-colors",
                  "hover:border-foreground/30 hover:bg-muted/40",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.severityTone} className="text-[10px] uppercase">
                      {item.severityLabel}
                    </Badge>
                    <span className="truncate text-sm font-medium">{item.primary}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{item.secondary}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
