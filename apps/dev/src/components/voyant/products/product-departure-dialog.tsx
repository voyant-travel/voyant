import { useProductItineraries } from "@voyantjs/products-react"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@/components/ui"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { api } from "@/lib/api-client"
import { getTimezoneLabel, TIMEZONE_IDS, TIMEZONE_OPTIONS } from "@/lib/timezone-options"
import { zodResolver } from "@/lib/zod-resolver"

const SLOT_STATUSES = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "sold_out", label: "Sold out" },
  { value: "cancelled", label: "Cancelled" },
] as const

const departureFormSchema = z
  .object({
    startDate: z.string().min(1, "Start date is required"),
    startTime: z.string().min(1, "Start time is required"),
    endDate: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),
    itineraryId: z.string().optional().nullable(),
    timezone: z.string().min(1, "Timezone is required"),
    status: z.enum(["open", "closed", "sold_out", "cancelled"]),
    unlimited: z.boolean(),
    initialPax: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    nights: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    days: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    notes: z.string().optional().nullable(),
  })
  .refine(
    (v) => {
      // End date must be >= start date when provided
      if (!v.endDate || typeof v.endDate !== "string" || v.endDate.length === 0) return true
      return v.endDate >= v.startDate
    },
    { message: "End date must be on or after start date", path: ["endDate"] },
  )
  .refine(
    (v) => {
      // If endTime provided without endDate, fine — we fall back to startDate.
      // If endDate equals startDate and both times provided, end must be >= start.
      const endDate =
        v.endDate && typeof v.endDate === "string" && v.endDate.length > 0 ? v.endDate : v.startDate
      const endTime =
        v.endTime && typeof v.endTime === "string" && v.endTime.length > 0 ? v.endTime : null
      if (!endTime) return true
      if (endDate > v.startDate) return true
      // Same day — require endTime >= startTime
      return endTime >= v.startTime
    },
    { message: "End time must be after start time on the same day", path: ["endTime"] },
  )

type DepartureFormValues = z.input<typeof departureFormSchema>
type DepartureFormOutput = z.output<typeof departureFormSchema>

export type DepartureSlot = {
  id: string
  productId: string
  itineraryId: string | null
  dateLocal: string
  startsAt: string
  endsAt: string | null
  timezone: string
  status: "open" | "closed" | "sold_out" | "cancelled"
  unlimited: boolean
  initialPax: number | null
  remainingPax: number | null
  nights: number | null
  days: number | null
  notes: string | null
}

type DepartureDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  slot?: DepartureSlot
  onSuccess: () => void
}

function combineLocalToIso(date: string, time: string): string {
  // Build a local datetime string and interpret it as UTC for API transport.
  // The backend stores the timezone separately, so the wall-clock time is what matters.
  const iso = new Date(`${date}T${time}:00Z`).toISOString()
  return iso
}

function isoToLocalDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function isoToLocalTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const mm = String(d.getUTCMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

export function DepartureDialog({
  open,
  onOpenChange,
  productId,
  slot,
  onSuccess,
}: DepartureDialogProps) {
  const isEditing = !!slot

  const defaultTz =
    typeof Intl !== "undefined"
      ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC")
      : "UTC"

  const form = useForm<DepartureFormValues, unknown, DepartureFormOutput>({
    resolver: zodResolver(departureFormSchema),
    defaultValues: {
      startDate: "",
      startTime: "09:00",
      endDate: "",
      endTime: "",
      itineraryId: "",
      timezone: defaultTz,
      status: "open",
      unlimited: false,
      initialPax: "",
      nights: "",
      days: "",
      notes: "",
    },
  })

  const unlimited = form.watch("unlimited")
  const startDate = form.watch("startDate")
  const endDate = form.watch("endDate")
  const timezone = form.watch("timezone")
  const { data: itineraryData } = useProductItineraries(productId, { enabled: open })
  const itineraries = itineraryData?.data ?? []
  const defaultItinerary = itineraries.find((itinerary) => itinerary.isDefault) ?? itineraries[0]

  // Compute number of nights for user feedback
  const nights = (() => {
    if (!startDate || !endDate || typeof endDate !== "string" || endDate.length === 0) return 0
    const start = new Date(`${startDate}T00:00:00Z`).getTime()
    const end = new Date(`${endDate}T00:00:00Z`).getTime()
    const diffDays = Math.round((end - start) / 86_400_000)
    return diffDays > 0 ? diffDays : 0
  })()

  useEffect(() => {
    if (open && slot) {
      form.reset({
        startDate: slot.dateLocal,
        startTime: isoToLocalTime(slot.startsAt),
        endDate: slot.endsAt ? isoToLocalDate(slot.endsAt) : "",
        endTime: slot.endsAt ? isoToLocalTime(slot.endsAt) : "",
        itineraryId: slot.itineraryId ?? "",
        timezone: slot.timezone,
        status: slot.status,
        unlimited: slot.unlimited,
        initialPax: slot.initialPax != null ? slot.initialPax : "",
        nights: slot.nights != null ? slot.nights : "",
        days: slot.days != null ? slot.days : "",
        notes: slot.notes ?? "",
      })
    } else if (open) {
      form.reset({
        startDate: "",
        startTime: "09:00",
        endDate: "",
        endTime: "",
        itineraryId: "",
        timezone: defaultTz,
        status: "open",
        unlimited: false,
        initialPax: "",
        notes: "",
      })
    }
  }, [open, slot, form, defaultTz])

  const onSubmit = async (values: DepartureFormOutput) => {
    const startsAt = combineLocalToIso(values.startDate, values.startTime)

    // Determine effective end date: explicit endDate, or fallback to startDate if only endTime provided
    const effectiveEndDate =
      values.endDate && typeof values.endDate === "string" && values.endDate.length > 0
        ? values.endDate
        : values.startDate
    const hasEndTime =
      values.endTime && typeof values.endTime === "string" && values.endTime.length > 0
    const hasExplicitEndDate =
      values.endDate && typeof values.endDate === "string" && values.endDate.length > 0

    // End timestamp only if user specified either an end date or end time
    const endsAt =
      hasEndTime || hasExplicitEndDate
        ? combineLocalToIso(effectiveEndDate, hasEndTime ? (values.endTime as string) : "18:00")
        : null

    const initialPax =
      !values.unlimited && typeof values.initialPax === "number" ? values.initialPax : null

    const nightsOverride = typeof values.nights === "number" ? values.nights : null
    const daysOverride = typeof values.days === "number" ? values.days : null

    const payload = {
      productId,
      itineraryId: values.itineraryId ? values.itineraryId : null,
      dateLocal: values.startDate,
      startsAt,
      endsAt,
      timezone: values.timezone,
      status: values.status,
      unlimited: values.unlimited,
      initialPax,
      remainingPax: initialPax,
      nights: nightsOverride,
      days: daysOverride,
      notes: values.notes || null,
    }

    if (isEditing) {
      await api.patch(`/v1/availability/slots/${slot.id}`, payload)
    } else {
      await api.post("/v1/availability/slots", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Departure" : "New Departure"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Start date</Label>
                <DatePicker
                  value={startDate || null}
                  onChange={(v) =>
                    form.setValue("startDate", v ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Pick a date"
                />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.startDate.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Start time</Label>
                <Input {...form.register("startTime")} type="time" />
                {form.formState.errors.startTime && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.startTime.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>
                  End date <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <DatePicker
                  value={typeof endDate === "string" && endDate.length > 0 ? endDate : null}
                  onChange={(v) =>
                    form.setValue("endDate", v ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Pick a date"
                  clearable
                  dateDisabled={
                    startDate ? { before: new Date(`${startDate}T00:00:00`) } : undefined
                  }
                />
                {form.formState.errors.endDate && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.endDate.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>
                  End time <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input {...form.register("endTime")} type="time" />
                {form.formState.errors.endTime && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.endTime.message}
                  </p>
                )}
              </div>
            </div>

            {nights > 0 && (
              <div className="grid grid-cols-[1fr_120px_120px] gap-4 items-end">
                <p className="text-xs text-muted-foreground">
                  Multi-day departure: {nights} night{nights === 1 ? "" : "s"} ({nights + 1} days)
                  by calendar. Override below if needed.
                </p>
                <div className="flex flex-col gap-2">
                  <Label>Nights (override)</Label>
                  <Input
                    {...form.register("nights")}
                    type="number"
                    min="0"
                    step="1"
                    placeholder={String(nights)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Days (override)</Label>
                  <Input
                    {...form.register("days")}
                    type="number"
                    min="0"
                    step="1"
                    placeholder={String(nights + 1)}
                  />
                </div>
              </div>
            )}

            {itineraries.length > 1 ? (
              <div className="flex flex-col gap-2">
                <Label>Itinerary</Label>
                <Select
                  items={[
                    {
                      label: `Default${defaultItinerary ? `: ${defaultItinerary.name}` : ""}`,
                      value: "",
                    },
                    ...itineraries.map((itinerary) => ({
                      label: itinerary.name,
                      value: itinerary.id,
                    })),
                  ]}
                  value={form.watch("itineraryId") ?? ""}
                  onValueChange={(value) => form.setValue("itineraryId", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">
                      Default
                      {defaultItinerary ? `: ${defaultItinerary.name}` : ""}
                    </SelectItem>
                    {itineraries.map((itinerary) => (
                      <SelectItem key={itinerary.id} value={itinerary.id}>
                        {itinerary.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Override which itinerary this departure follows. Default tracks whichever
                  itinerary is marked as default.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Timezone</Label>
                <Combobox
                  items={TIMEZONE_IDS}
                  value={timezone || null}
                  autoHighlight
                  itemToStringValue={(id) => getTimezoneLabel(id as string)}
                  onValueChange={(next) => {
                    if (typeof next === "string") {
                      form.setValue("timezone", next, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  }}
                >
                  <ComboboxInput placeholder="Search timezones…" />
                  <ComboboxContent>
                    <ComboboxEmpty>No timezone found.</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxCollection>
                        {(id) => {
                          const tz = TIMEZONE_OPTIONS.find((t) => t.id === (id as string))
                          return (
                            <ComboboxItem key={id as string} value={id as string}>
                              <span className="font-mono text-xs">{id as string}</span>
                              {tz ? (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {tz.label}
                                </span>
                              ) : null}
                            </ComboboxItem>
                          )
                        }}
                      </ComboboxCollection>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {form.formState.errors.timezone && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.timezone.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  items={SLOT_STATUSES}
                  value={form.watch("status")}
                  onValueChange={(v) => form.setValue("status", v as DepartureFormValues["status"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SLOT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="flex items-center gap-2">
                <Switch
                  id="unlimited"
                  checked={unlimited}
                  onCheckedChange={(c) => form.setValue("unlimited", c)}
                />
                <Label htmlFor="unlimited" className="font-normal cursor-pointer">
                  Unlimited capacity
                </Label>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Capacity (pax)</Label>
                <Input
                  {...form.register("initialPax")}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  disabled={unlimited}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} placeholder="Internal notes..." />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Departure"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
