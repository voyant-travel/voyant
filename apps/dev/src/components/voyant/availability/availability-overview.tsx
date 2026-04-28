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
import type {
  AvailabilityPickupPointRow,
  AvailabilityRuleRow,
  AvailabilitySlotRow,
  ProductOption,
} from "./availability-shared"
import { formatDateTime, productNameById } from "./availability-shared"

export function AvailabilityOverview({
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
          title="Open Slots"
          value={openSlotsCount}
          description="Departures currently bookable"
          icon={CalendarDays}
        />
        <OverviewMetric
          title="Constrained Slots"
          value={constrainedSlots.length}
          description="Closed or sold-out departures"
          icon={Clock3}
        />
        <OverviewMetric
          title="Active Rules"
          value={activeRulesCount}
          description="Recurring operating patterns live"
          icon={Package}
        />
        <OverviewMetric
          title="Pickup Points"
          value={activePickupPointsCount}
          description="Active operational pickup locations"
          icon={Truck}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Capacity Watchlist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {constrainedSlots.length === 0 ? (
              <p className="text-muted-foreground">No constrained departures right now.</p>
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
                    {formatDateTime(slot.startsAt)} · {slot.status.replace("_", " ")} · Remaining
                    Pax: {slot.remainingPax ?? "-"}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Coverage Gaps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {productsWithoutActiveRules.length === 0 ? (
              <p className="text-muted-foreground">Every product has at least one active rule.</p>
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
                    No active availability rule is attached yet.
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
              placeholder="Search availability..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={productFilter} onValueChange={(value) => setProductFilter(value ?? "all")}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
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
            Clear Filters
          </Button>
        ) : null}
      </div>
    </>
  )
}
