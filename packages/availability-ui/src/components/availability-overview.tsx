"use client"

import type {
  AvailabilityPickupPointRow,
  AvailabilityRuleRow,
  AvailabilitySlotRow,
  ProductOption,
} from "@voyantjs/availability-react"
import { formatDateTime, productNameById } from "@voyantjs/availability-react"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  OverviewMetric,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { CalendarDays, Clock3, Package, Search, Truck } from "lucide-react"
import { type AvailabilityColumnsMessages, getSlotStatusLabel } from "./availability-columns.js"

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
  }
}

export function AvailabilityOverview({
  messages,
  products,
  constrainedSlots,
  filteredRules,
  filteredPickupPoints,
  productsWithoutActiveRules,
  search,
  setSearch,
  productFilter,
  setProductFilter,
  hasFilters,
  onClearFilters,
  onOpenSlot,
  onOpenProduct,
}: {
  messages: AvailabilityOverviewMessages
  products: ProductOption[]
  constrainedSlots: AvailabilitySlotRow[]
  filteredRules: AvailabilityRuleRow[]
  filteredPickupPoints: AvailabilityPickupPointRow[]
  productsWithoutActiveRules: ProductOption[]
  search: string
  setSearch: (value: string) => void
  productFilter: string
  setProductFilter: (value: string) => void
  hasFilters: boolean
  onClearFilters: () => void
  onOpenSlot: (slotId: string) => void
  onOpenProduct: (productId: string) => void
}) {
  const openSlotsCount = constrainedSlots.filter((slot) => slot.status === "open").length
  const activeRulesCount = filteredRules.filter((rule) => rule.active).length
  const activePickupPointsCount = filteredPickupPoints.filter(
    (pickupPoint) => pickupPoint.active,
  ).length

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric
          title={messages.overview.openSlotsTitle}
          value={openSlotsCount}
          description={messages.overview.openSlotsDescription}
          icon={CalendarDays}
        />
        <OverviewMetric
          title={messages.overview.constrainedSlotsTitle}
          value={constrainedSlots.length}
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{messages.overview.capacityWatchlistTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {constrainedSlots.length === 0 ? (
              <p className="text-muted-foreground">{messages.overview.capacityWatchlistEmpty}</p>
            ) : (
              constrainedSlots.slice(0, 4).map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() => onOpenSlot(slot.id)}
                >
                  <div className="font-medium">
                    {productNameById(products, slot.productId, slot.productName)} · {slot.dateLocal}
                  </div>
                  <div className="text-muted-foreground">
                    {formatDateTime(slot.startsAt)} · {getSlotStatusLabel(slot.status, messages)} ·{" "}
                    {messages.remainingPaxLabel}: {slot.remainingPax ?? messages.details.noValue}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>{messages.overview.coverageGapsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {productsWithoutActiveRules.length === 0 ? (
              <p className="text-muted-foreground">{messages.overview.coverageGapsEmpty}</p>
            ) : (
              productsWithoutActiveRules.slice(0, 4).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() => onOpenProduct(product.id)}
                >
                  <div className="font-medium">{product.name}</div>
                  <div className="text-muted-foreground">
                    {messages.overview.coverageGapDescription}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

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
          <Select value={productFilter} onValueChange={(value) => setProductFilter(value ?? "all")}>
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
    </>
  )
}
