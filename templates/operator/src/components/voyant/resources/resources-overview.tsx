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
import { useAdminMessages } from "@/lib/admin-i18n"
import type {
  BookingOption,
  ResourceCloseoutRow,
  ResourceRow,
  ResourceSlotAssignmentRow,
  SlotOption,
} from "./resources-shared"
import {
  getAssignmentStatusLabel,
  getResourceKindLabel,
  labelById,
  resourceKindOptions,
  slotLabel,
} from "./resources-shared"

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
  const messages = useAdminMessages()
  const overviewMessages = messages.resources.overview
  const activeResourcesCount = filteredResources.filter((resource) => resource.active).length
  const activePoolsCount = filteredPools.filter((pool) => pool.active).length

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric
          title={overviewMessages.activeResourcesTitle}
          value={activeResourcesCount}
          description={overviewMessages.activeResourcesDescription}
          icon={Wrench}
        />
        <OverviewMetric
          title={overviewMessages.activePoolsTitle}
          value={activePoolsCount}
          description={overviewMessages.activePoolsDescription}
          icon={Users}
        />
        <OverviewMetric
          title={overviewMessages.liveAssignmentsTitle}
          value={liveAssignments.length}
          description={overviewMessages.liveAssignmentsDescription}
          icon={CalendarDays}
        />
        <OverviewMetric
          title={overviewMessages.closeoutsTitle}
          value={closeouts.length}
          description={overviewMessages.closeoutsDescription}
          icon={ExternalLink}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{overviewMessages.assignmentGapsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {unassignedReservations.length === 0 ? (
              <p className="text-muted-foreground">{overviewMessages.assignmentGapsEmpty}</p>
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
                    {overviewMessages.assignmentGapStatusLabel}:{" "}
                    {getAssignmentStatusLabel(assignment.status, messages)} ·{" "}
                    {overviewMessages.assignmentGapBookingLabel}:{" "}
                    {labelById(bookings, assignment.bookingId)}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>{overviewMessages.ownershipGapsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {resourcesWithoutSupplier.length === 0 ? (
              <p className="text-muted-foreground">{overviewMessages.ownershipGapsEmpty}</p>
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
                    {getResourceKindLabel(resource.kind, messages)} ·{" "}
                    {messages.resources.capacityLabel}{" "}
                    {resource.capacity ?? messages.resources.details.noValue} ·{" "}
                    {overviewMessages.ownershipGapNoSupplier}
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
              placeholder={messages.resources.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={kindFilter} onValueChange={(value) => setKindFilter(value ?? "all")}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue placeholder={messages.resources.allKinds} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{messages.resources.allKinds}</SelectItem>
              {resourceKindOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {messages.resources.kindLabels[option.value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasFilters ? (
          <Button variant="outline" onClick={onClearFilters}>
            {messages.resources.clearFilters}
          </Button>
        ) : null}
      </div>
    </>
  )
}
