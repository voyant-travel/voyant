import { formatMessage } from "@voyant-travel/i18n"
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
} from "@voyant-travel/ui/components"
import { CalendarDays, ExternalLink, Search, Users, Wrench } from "lucide-react"
import { useResourcesUiI18nOrDefault } from "../i18n/index.js"
import { formatResourceSlotLabel, RESOURCE_KIND_VALUES } from "../i18n/utils.js"
import type {
  BookingOption,
  ProductOption,
  ResourceCloseoutRow,
  ResourceRow,
  ResourceSlotAssignmentRow,
  SlotOption,
} from "../index.js"
import { labelById } from "../index.js"

export function ResourcesOverview({
  bookings,
  products = [],
  slots,
  closeouts,
  filteredResources,
  filteredPools,
  liveAssignments,
  resourcesWithoutSupplier,
  unassignedReservations,
  search,
  setSearch,
  kindFilter,
  setKindFilter,
  hasFilters,
  onClearFilters,
  onOpenAssignment,
  onOpenResource,
  showFilters = true,
}: {
  bookings: BookingOption[]
  products?: ProductOption[]
  slots: SlotOption[]
  closeouts: ResourceCloseoutRow[]
  filteredResources: ResourceRow[]
  filteredPools: Array<{ active: boolean }>
  liveAssignments: ResourceSlotAssignmentRow[]
  resourcesWithoutSupplier: ResourceRow[]
  unassignedReservations: ResourceSlotAssignmentRow[]
  search: string
  setSearch: (value: string) => void
  kindFilter: string
  setKindFilter: (value: string) => void
  hasFilters: boolean
  onClearFilters: () => void
  onOpenAssignment: (assignmentId: string) => void
  onOpenResource: (resourceId: string) => void
  /**
   * When false, hides the inline search + kind filter row. Templates that
   * surface those controls in the page header (mirroring availability) pass
   * `false` so the affordance isn't duplicated.
   */
  showFilters?: boolean
}) {
  const i18n = useResourcesUiI18nOrDefault()
  const m = i18n.messages
  const activeResourcesCount = filteredResources.filter((resource) => resource.active).length
  const activePoolsCount = filteredPools.filter((pool) => pool.active).length
  const kindOptions = RESOURCE_KIND_VALUES.map((value) => ({
    value,
    label: m.common.resourceKindLabels[value],
  }))

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric
          title={m.overview.metrics.activeResources.title}
          value={i18n.formatNumber(activeResourcesCount)}
          description={m.overview.metrics.activeResources.description}
          icon={Wrench}
        />
        <OverviewMetric
          title={m.overview.metrics.activePools.title}
          value={i18n.formatNumber(activePoolsCount)}
          description={m.overview.metrics.activePools.description}
          icon={Users}
        />
        <OverviewMetric
          title={m.overview.metrics.liveAssignments.title}
          value={i18n.formatNumber(liveAssignments.length)}
          description={m.overview.metrics.liveAssignments.description}
          icon={CalendarDays}
        />
        <OverviewMetric
          title={m.overview.metrics.closeouts.title}
          value={i18n.formatNumber(closeouts.length)}
          description={m.overview.metrics.closeouts.description}
          icon={ExternalLink}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{m.overview.assignmentGaps.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {unassignedReservations.length === 0 ? (
              <p className="text-muted-foreground">{m.overview.assignmentGaps.empty}</p>
            ) : (
              unassignedReservations.slice(0, 4).map((assignment) => (
                <button
                  key={assignment.id}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() => onOpenAssignment(assignment.id)}
                >
                  <div className="font-medium">
                    {formatResourceSlotLabel(
                      slots.find((slot) => slot.id === assignment.slotId) ?? {
                        id: assignment.slotId,
                        productId: "",
                        dateLocal: assignment.slotId,
                        startsAt: assignment.slotId,
                      },
                      {
                        template: m.common.slotLabel,
                        formatDate: i18n.formatDate,
                        products,
                      },
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    {formatMessage(m.overview.assignmentGaps.statusBooking, {
                      status: m.common.assignmentStatusLabels[assignment.status],
                      booking: labelById(bookings, assignment.bookingId),
                    })}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>{m.overview.ownershipGaps.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {resourcesWithoutSupplier.length === 0 ? (
              <p className="text-muted-foreground">{m.overview.ownershipGaps.empty}</p>
            ) : (
              resourcesWithoutSupplier.slice(0, 4).map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() => onOpenResource(resource.id)}
                >
                  <div className="font-medium">{resource.name}</div>
                  <div className="text-muted-foreground">
                    {formatMessage(m.overview.ownershipGaps.detail, {
                      kind: m.common.resourceKindLabels[resource.kind],
                      capacity:
                        resource.capacity === null ? "-" : i18n.formatNumber(resource.capacity),
                    })}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {showFilters ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={m.overview.filters.searchPlaceholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={kindFilter} onValueChange={(value) => setKindFilter(value ?? "all")}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder={m.overview.filters.allKindsPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{m.common.allKinds}</SelectItem>
                {kindOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasFilters ? (
            <Button variant="outline" onClick={onClearFilters}>
              {m.common.clearFilters}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
