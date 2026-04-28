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
import { CalendarDays, ExternalLink, Search, Users, Wrench } from "lucide-react"
import type {
  BookingOption,
  ResourceCloseoutRow,
  ResourceRow,
  ResourceSlotAssignmentRow,
  SlotOption,
} from "./resources-shared"
import { labelById, resourceKindOptions, slotLabel } from "./resources-shared"

export function ResourcesOverview({
  bookings,
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
}: {
  bookings: BookingOption[]
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
}) {
  const activeResourcesCount = filteredResources.filter((resource) => resource.active).length
  const activePoolsCount = filteredPools.filter((pool) => pool.active).length

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric
          title="Active Resources"
          value={activeResourcesCount}
          description="Assignable assets ready for use"
          icon={Wrench}
        />
        <OverviewMetric
          title="Active Pools"
          value={activePoolsCount}
          description="Shared-capacity pools live"
          icon={Users}
        />
        <OverviewMetric
          title="Live Assignments"
          value={liveAssignments.length}
          description="Reserved or assigned slot coverage"
          icon={CalendarDays}
        />
        <OverviewMetric
          title="Closeouts"
          value={closeouts.length}
          description="Active maintenance or conflict blocks"
          icon={ExternalLink}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Assignment Gaps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {unassignedReservations.length === 0 ? (
              <p className="text-muted-foreground">Every live reservation has a named resource.</p>
            ) : (
              unassignedReservations.slice(0, 4).map((assignment) => (
                <button
                  key={assignment.id}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() => onOpenAssignment(assignment.id)}
                >
                  <div className="font-medium">
                    {slotLabel(
                      slots.find((slot) => slot.id === assignment.slotId) ?? {
                        id: assignment.slotId,
                        productId: "",
                        dateLocal: assignment.slotId,
                        startsAt: assignment.slotId,
                      },
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    Status: {assignment.status} · Booking:{" "}
                    {labelById(bookings, assignment.bookingId)}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Ownership Gaps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {resourcesWithoutSupplier.length === 0 ? (
              <p className="text-muted-foreground">Every resource is linked to a supplier.</p>
            ) : (
              resourcesWithoutSupplier.slice(0, 4).map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() => onOpenResource(resource.id)}
                >
                  <div className="font-medium">{resource.name}</div>
                  <div className="text-muted-foreground capitalize">
                    {resource.kind} · Capacity {resource.capacity ?? "-"} · No supplier assigned
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
              placeholder="Search resources..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={kindFilter} onValueChange={(value) => setKindFilter(value ?? "all")}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue placeholder="All kinds" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              {resourceKindOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
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
