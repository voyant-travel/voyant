import { describeRRule } from "@voyantjs/availability/rrule"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Textarea,
} from "@voyantjs/ui/components"
import { CalendarClock, FileText, Loader2, Pencil, Plus, Repeat, Trash2 } from "lucide-react"
import type { DepartureSlot } from "./product-departure-dialog"
import { DayRow } from "./product-detail-day-row"
import {
  type DayService,
  formatCapacity,
  formatDuration,
  formatSlotDate,
  formatSlotTime,
  type ProductDay,
  slotStatusVariant,
} from "./product-detail-shared"
import type { AvailabilityRule } from "./product-schedule-dialog"

export function ProductDeparturesCard(props: {
  slots: DepartureSlot[]
  onCreate: () => void
  onEdit: (slot: DepartureSlot) => void
  onDelete: (slotId: string) => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          Departures
        </CardTitle>
        <Button size="sm" onClick={props.onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Departure
        </Button>
      </CardHeader>
      <CardContent>
        {props.slots.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No departures yet. Add a one-off departure or create a recurring schedule below.
          </p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">Start</th>
                  <th className="p-2 text-left font-medium">End</th>
                  <th className="p-2 text-left font-medium">Duration</th>
                  <th className="p-2 text-left font-medium">Status</th>
                  <th className="p-2 text-left font-medium">Capacity</th>
                  <th className="p-2 text-left font-medium">Timezone</th>
                  <th className="w-20 p-2" />
                </tr>
              </thead>
              <tbody>
                {props.slots.map((slot) => (
                  <tr key={slot.id} className="border-b last:border-b-0">
                    <td className="p-2">
                      <div className="font-mono text-xs">{slot.dateLocal}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatSlotTime(slot.startsAt)}
                      </div>
                    </td>
                    <td className="p-2">
                      {slot.endsAt ? (
                        <>
                          <div className="font-mono text-xs">{formatSlotDate(slot.endsAt)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatSlotTime(slot.endsAt)}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-2 text-xs">{formatDuration(slot)}</td>
                    <td className="p-2">
                      <Badge
                        variant={slotStatusVariant[slot.status]}
                        className="text-xs capitalize"
                      >
                        {slot.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="p-2 font-mono text-xs">{formatCapacity(slot)}</td>
                    <td className="p-2 text-xs text-muted-foreground">{slot.timezone}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => props.onEdit(slot)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => props.onDelete(slot.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ProductSchedulesCard(props: {
  rules: AvailabilityRule[]
  onCreate: () => void
  onEdit: (rule: AvailabilityRule) => void
  onDelete: (ruleId: string) => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Repeat className="h-4 w-4" />
          Recurring Schedules
        </CardTitle>
        <Button size="sm" variant="outline" onClick={props.onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </CardHeader>
      <CardContent>
        {props.rules.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No recurring schedules. Define a rule to auto-generate departures.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {props.rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{describeRRule(rule.recurrenceRule)}</span>
                    {!rule.active ? (
                      <Badge variant="outline" className="text-xs">
                        inactive
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Max {rule.maxCapacity} pax · {rule.timezone}
                    {rule.cutoffMinutes != null ? ` · cutoff ${rule.cutoffMinutes}m` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => props.onEdit(rule)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => props.onDelete(rule.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ProductItineraryCard(props: {
  productId: string
  days: ProductDay[]
  expandedDayId: string | null
  onToggleDay: (dayId: string) => void
  onCreateDay: () => void
  onEditDay: (day: ProductDay) => void
  onDeleteDay: (dayId: string) => void
  onAddService: (dayId: string) => void
  onEditService: (dayId: string, service: DayService) => void
  onDeleteService: (dayId: string, serviceId: string) => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Itinerary</CardTitle>
        <Button size="sm" onClick={props.onCreateDay}>
          <Plus className="mr-2 h-4 w-4" />
          Add Day
        </Button>
      </CardHeader>
      <CardContent>
        {props.days.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No days yet.</p>
        ) : null}
        <div className="flex flex-col gap-2">
          {props.days.map((day) => (
            <DayRow
              key={day.id}
              day={day}
              productId={props.productId}
              expanded={props.expandedDayId === day.id}
              onToggle={() => props.onToggleDay(day.id)}
              onEdit={() => props.onEditDay(day)}
              onDelete={() => props.onDeleteDay(day.id)}
              onAddService={() => props.onAddService(day.id)}
              onEditService={(service) => props.onEditService(day.id, service)}
              onDeleteService={(serviceId) => props.onDeleteService(day.id, serviceId)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function ProductVersionsCard({
  versions,
}: {
  versions: Array<{ id: string; versionNumber: number; notes: string | null; createdAt: string }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Versions</CardTitle>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No versions yet.</p>
        ) : null}
        {versions.map((version) => (
          <div key={version.id} className="mb-2 flex items-center gap-4 rounded-md border p-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-sm font-medium">Version {version.versionNumber}</span>
              {version.notes ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{version.notes}</p>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(version.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function ProductNotesCard(props: {
  noteContent: string
  setNoteContent: (value: string) => void
  isAdding: boolean
  onAddNote: () => void
  notes: Array<{ id: string; content: string; createdAt: string }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Textarea
            placeholder="Add a note..."
            value={props.noteContent}
            onChange={(e) => props.setNoteContent(e.target.value)}
            className="min-h-[80px]"
          />
          <Button
            className="self-end"
            disabled={!props.noteContent.trim() || props.isAdding}
            onClick={props.onAddNote}
          >
            {props.isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>

        {props.notes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No notes yet.</p>
        ) : null}

        {props.notes.map((note) => (
          <div key={note.id} className="rounded-md border p-3">
            <p className="whitespace-pre-wrap text-sm">{note.content}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(note.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
