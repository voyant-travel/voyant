"use client"

import { describeRRule } from "@voyantjs/availability/rrule"
import {
  useAvailabilityRuleMutation,
  useAvailabilitySlotMutation,
  useRules,
  useSlots,
} from "@voyantjs/availability-react"
import { useProductItineraries } from "@voyantjs/products-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { CalendarClock, Loader2, Pencil, Plus, Repeat, Trash2 } from "lucide-react"
import * as React from "react"
import { DepartureDialog } from "./product-departure-dialog"
import {
  formatCapacity,
  formatDuration,
  formatSlotDate,
  formatSlotTime,
  slotStatusVariant,
} from "./product-detail-shared"
import { ScheduleDialog } from "./product-schedule-dialog"

export interface ProductAvailabilitySectionProps {
  productId: string
  pageSize?: number
}

export function ProductAvailabilitySection({
  productId,
  pageSize = 100,
}: ProductAvailabilitySectionProps) {
  const [departureDialogOpen, setDepartureDialogOpen] = React.useState(false)
  const [scheduleDialogOpen, setScheduleDialogOpen] = React.useState(false)
  const [editingSlotId, setEditingSlotId] = React.useState<string | null>(null)
  const [editingRuleId, setEditingRuleId] = React.useState<string | null>(null)

  const {
    data: slotsData,
    isPending: isSlotsPending,
    isError: isSlotsError,
  } = useSlots({ productId, limit: pageSize })
  const {
    data: rulesData,
    isPending: isRulesPending,
    isError: isRulesError,
  } = useRules({ productId, limit: pageSize })
  const { data: itineraryData } = useProductItineraries(productId)
  const { remove: removeSlot } = useAvailabilitySlotMutation()
  const { remove: removeRule } = useAvailabilityRuleMutation()
  const itineraryNameById = React.useMemo(
    () => new Map((itineraryData?.data ?? []).map((itinerary) => [itinerary.id, itinerary.name])),
    [itineraryData?.data],
  )

  const slots = React.useMemo(
    () =>
      (slotsData?.data ?? [])
        .slice()
        .sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    [slotsData?.data],
  )
  const rules = React.useMemo(
    () => (rulesData?.data ?? []).slice().sort((left, right) => right.id.localeCompare(left.id)),
    [rulesData?.data],
  )
  const editingSlot = React.useMemo(
    () => slots.find((slot) => slot.id === editingSlotId),
    [editingSlotId, slots],
  )
  const editingRule = React.useMemo(
    () => rules.find((rule) => rule.id === editingRuleId),
    [editingRuleId, rules],
  )

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Availability</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage one-off departures and recurring schedules for this product.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingSlotId(null)
              setDepartureDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            New departure
          </Button>
        </CardHeader>
        <CardContent>
          {isSlotsPending ? (
            <div className="flex min-h-24 items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : isSlotsError ? (
            <p className="text-sm text-destructive">Failed to load departures.</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No departures yet. Add a one-off departure or create a recurring schedule below.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Itinerary</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell>
                        <div className="font-mono text-xs">{slot.dateLocal}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatSlotTime(slot.startsAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {slot.endsAt ? (
                          <>
                            <div className="font-mono text-xs">{formatSlotDate(slot.endsAt)}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatSlotTime(slot.endsAt)}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {slot.itineraryId
                          ? (itineraryNameById.get(slot.itineraryId) ?? "Custom override")
                          : "Default"}
                      </TableCell>
                      <TableCell className="text-xs">{formatDuration(slot)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={slotStatusVariant[slot.status] ?? "outline"}
                          className="capitalize"
                        >
                          {slot.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{formatCapacity(slot)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {slot.timezone}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setEditingSlotId(slot.id)
                              setDepartureDialogOpen(true)
                            }}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              if (confirm("Delete this departure?")) {
                                removeSlot.mutate(slot.id)
                              }
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Repeat className="size-4" aria-hidden="true" />
              Recurring schedules
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Define rules that can generate departures automatically.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setEditingRuleId(null)
              setScheduleDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            New schedule
          </Button>
        </CardHeader>
        <CardContent>
          {isRulesPending ? (
            <div className="flex min-h-24 items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : isRulesError ? (
            <p className="text-sm text-destructive">Failed to load schedules.</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recurring schedules. Define a rule to auto-generate departures.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center gap-3 rounded-md border p-3 text-sm"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span className="font-medium">{describeRRule(rule.recurrenceRule)}</span>
                      {!rule.active ? <Badge variant="outline">Inactive</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Max {rule.maxCapacity} pax · {rule.timezone}
                      {rule.cutoffMinutes != null ? ` · cutoff ${rule.cutoffMinutes}m` : ""}
                      {rule.minTotalPax != null ? ` · min ${rule.minTotalPax} pax` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditingRuleId(rule.id)
                        setScheduleDialogOpen(true)
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm("Delete this recurring schedule?")) {
                          removeRule.mutate(rule.id)
                        }
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DepartureDialog
        open={departureDialogOpen}
        onOpenChange={setDepartureDialogOpen}
        productId={productId}
        slot={editingSlot}
        onSuccess={() => {
          setEditingSlotId(null)
          setDepartureDialogOpen(false)
        }}
      />
      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        productId={productId}
        rule={editingRule}
        onSuccess={() => {
          setEditingRuleId(null)
          setScheduleDialogOpen(false)
        }}
      />
    </div>
  )
}
