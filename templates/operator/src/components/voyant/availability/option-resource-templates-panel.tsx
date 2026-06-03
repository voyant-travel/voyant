"use client"

import { SeatMapBuilder } from "@voyantjs/allocation-ui"
import {
  type SeatLayoutSpec,
  seatLayoutSpecSchema,
  useMaterializeOpenSlotsMutation,
  useProductResourceTemplates,
  useResourceTemplateMutation,
} from "@voyantjs/availability-react"
import { formatMessage } from "@voyantjs/i18n"
import { useOptionUnits } from "@voyantjs/products-react"
import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
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
} from "@voyantjs/ui/components"
import {
  Armchair,
  Bed,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

/**
 * Per-option Resource templates editor. Templates drive the Allocation
 * tab's "Generate resources" automation — without a template configured
 * for an option, no rooms/seats/etc. are materialized when bookings hit
 * a slot.
 *
 * Each template is identified by `(optionId, kind)`. Common kinds:
 *   - `room` — accommodation rooms (default capacity 2)
 *   - `vehicle_seat` — coach/van seats (capacity 1)
 *   - `cabin` — cruise cabins
 *
 * The kind field is a free-form string on the server; we constrain the
 * picker to the known set for UX, but operators can extend by typing.
 */
export interface OptionResourceTemplatesPanelProps {
  productId: string
  optionId: string
}

type ResourceTemplateKind = "room" | "vehicle_seat" | "cabin" | "flight_seat"
// Defaults populate the namePattern field when the operator picks a kind. They
// are starting points the operator edits before saving, not display labels —
// the localized prompt copy lives in the dialog's namePatternPlaceholder.
const COMMON_KINDS: ReadonlyArray<{ value: ResourceTemplateKind; defaultPattern: string }> = [
  // i18n-literal-ok
  { value: "room", defaultPattern: "Room {sequence}" },
  // i18n-literal-ok
  { value: "vehicle_seat", defaultPattern: "Seat {sequence}" },
  // i18n-literal-ok
  { value: "cabin", defaultPattern: "Cabin {sequence}" },
  // i18n-literal-ok
  { value: "flight_seat", defaultPattern: "Seat {sequence}" },
]

// Derive a stable, unique resource `kind` from a room unit so each room type
// (Single/Double/Triple) generates its own physical resources. The kind is a
// free-text slug — distinct kinds avoid the (option, kind) unique constraint.
function roomUnitToKind(unit: { code: string | null; name: string }): string {
  const slug = (unit.code || unit.name || "room")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return slug || "room"
}

export function OptionResourceTemplatesPanel({
  productId,
  optionId,
}: OptionResourceTemplatesPanelProps) {
  const adminMessages = useAdminMessages()
  const t = adminMessages.availability.details.resourceTemplates
  const { data, isPending, isError } = useProductResourceTemplates({ productId })
  const { upsert, remove } = useResourceTemplateMutation(productId)
  const materializeOpenSlots = useMaterializeOpenSlotsMutation(productId)

  const templates = useMemo(() => {
    const option = (data?.data ?? []).find((entry) => entry.id === optionId)
    return option?.templates ?? []
  }, [data?.data, optionId])
  const totalPerDeparture = useMemo(
    () => templates.reduce((sum, template) => sum + (template.defaultCount ?? 0), 0),
    [templates],
  )

  // The option's room units already carry quantity (maxQuantity) and occupancy
  // — generate departure inventory straight from them instead of re-typing it.
  const { data: unitsData } = useOptionUnits({ optionId, limit: 100 })
  const roomUnits = useMemo(
    () => (unitsData?.data ?? []).filter((unit) => unit.unitType === "room"),
    [unitsData?.data],
  )

  const [open, setOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [seatMapOpen, setSeatMapOpen] = useState(false)
  const [editingKind, setEditingKind] = useState<string | null>(null)
  const [kindValue, setKindValue] = useState<string>("room")
  const [capacityValue, setCapacityValue] = useState<number>(2)
  const [defaultCountValue, setDefaultCountValue] = useState<number>(1)
  const [namePatternValue, setNamePatternValue] = useState<string>("Room {sequence}")
  const [layoutSpec, setLayoutSpec] = useState<SeatLayoutSpec | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applyResult, setApplyResult] = useState<string | null>(null)

  const derivedSeatCount = useMemo(() => countSeats(layoutSpec), [layoutSpec])
  const usingSeatMap = kindValue === "vehicle_seat" && layoutSpec !== null

  function openCreate() {
    setEditingKind(null)
    setKindValue("room")
    setCapacityValue(2)
    setDefaultCountValue(1)
    setNamePatternValue("Room {sequence}")
    setLayoutSpec(null)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(template: {
    kind: string
    capacity: number
    defaultCount: number | null
    namePattern: string
    flags: Record<string, unknown>
  }) {
    setEditingKind(template.kind)
    setKindValue(template.kind)
    setCapacityValue(template.capacity)
    setDefaultCountValue(template.defaultCount ?? 0)
    setNamePatternValue(template.namePattern)
    setLayoutSpec(extractLayoutSpec(template.flags))
    setError(null)
    setDialogOpen(true)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const trimmedKind = kindValue.trim()
    const trimmedPattern = namePatternValue.trim()
    const effectiveCapacity = usingSeatMap ? derivedSeatCount : capacityValue
    if (!trimmedKind || !trimmedPattern || effectiveCapacity < 1) {
      setError(t.validation)
      return
    }
    const flags: Record<string, unknown> = {}
    if (trimmedKind === "vehicle_seat" && layoutSpec) {
      flags.layoutSpec = layoutSpec
    }
    try {
      await upsert.mutateAsync({
        optionId,
        kind: trimmedKind,
        input: {
          capacity: effectiveCapacity,
          defaultCount: defaultCountValue > 0 ? defaultCountValue : null,
          namePattern: trimmedPattern,
          flags,
        },
      })
      setDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveFailed)
    }
  }

  async function handleRemove(kind: string) {
    if (!globalThis.confirm?.(formatMessage(t.deleteConfirm, { kind }))) return
    try {
      await remove.mutateAsync({ optionId, kind })
    } catch (err) {
      setError(err instanceof Error ? err.message : t.deleteFailed)
    }
  }

  async function generateFromRooms() {
    setError(null)
    try {
      for (const unit of roomUnits) {
        await upsert.mutateAsync({
          optionId,
          kind: roomUnitToKind(unit),
          input: {
            capacity: unit.occupancyMax ?? unit.occupancyMin ?? 1,
            defaultCount: unit.maxQuantity ?? null,
            namePattern: `${unit.name} {sequence}`,
            flags: {},
          },
        })
      }
      setOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveFailed)
    }
  }

  async function applyToOpenDepartures() {
    if (!globalThis.confirm?.(t.applyToOpenConfirm)) return
    setError(null)
    setApplyResult(null)
    try {
      const result = await materializeOpenSlots.mutateAsync({ optionId })
      setApplyResult(
        result.slots === 0
          ? t.applyToOpenEmpty
          : formatMessage(t.applyToOpenResult, {
              created: result.created,
              slots: result.slots,
            }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : t.applyToOpenFailed)
    }
  }

  const matchingCommon = COMMON_KINDS.find((entry) => entry.value === kindValue)
  const isExtendedKind = !matchingCommon && kindValue.trim().length > 0

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border bg-background/60">
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
          <Bed className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium text-sm">{t.title}</span>
          <Badge variant="secondary" className="font-normal">
            {templates.length === 0
              ? t.collapsedEmpty
              : formatMessage(t.collapsedSummary, {
                  count: templates.length,
                  total: totalPerDeparture,
                })}
          </Badge>
          <span className="flex-1" />
          {open ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-3 border-t p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-muted-foreground text-xs">{t.description}</p>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {templates.length > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void applyToOpenDepartures()}
                    disabled={materializeOpenSlots.isPending}
                  >
                    <CalendarCheck className="mr-1 size-4" aria-hidden="true" />
                    {t.applyToOpenButton}
                  </Button>
                ) : null}
                {roomUnits.length > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void generateFromRooms()}
                    disabled={upsert.isPending}
                  >
                    <Sparkles className="mr-1 size-4" aria-hidden="true" />
                    {t.generateFromRooms}
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={openCreate}>
                  <Plus className="mr-1 size-4" aria-hidden="true" />
                  {t.addButton}
                </Button>
              </div>
            </div>
            {applyResult ? (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-muted-foreground text-xs">
                {applyResult}
              </p>
            ) : null}
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
            {isPending ? (
              <p className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
                <Loader2 className="size-3.5 animate-spin" />
              </p>
            ) : isError ? (
              <p className="py-4 text-center text-destructive text-sm">{t.loadFailed}</p>
            ) : templates.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-center text-muted-foreground text-xs">
                {roomUnits.length > 0 ? t.generateFromRoomsHint : t.emptyMessage}
              </p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-md border">
                {templates.map((template) => (
                  <li
                    key={template.kind}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {(t.kinds as Record<string, string>)[template.kind] ?? template.kind}
                        </Badge>
                        <span className="text-sm">
                          {formatMessage(t.capacitySummary, {
                            capacity: template.capacity,
                            count: template.defaultCount ?? 0,
                            pattern: template.namePattern,
                          })}
                        </span>
                        {template.kind === "vehicle_seat" ? (
                          <SeatMapSummaryBadge flags={template.flags} messages={t} />
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() =>
                          openEdit({
                            kind: template.kind,
                            capacity: template.capacity,
                            defaultCount: template.defaultCount,
                            namePattern: template.namePattern,
                            flags: template.flags,
                          })
                        }
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => void handleRemove(template.kind)}
                        disabled={remove.isPending}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CollapsibleContent>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingKind ? formatMessage(t.editTitle, { kind: editingKind }) : t.newTitle}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit}>
            <DialogBody className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="resource-template-kind">{t.kindLabel}</Label>
                <Select
                  value={isExtendedKind ? "__custom__" : kindValue}
                  onValueChange={(value) => {
                    if (!value || value === "__custom__") {
                      setKindValue("")
                      return
                    }
                    setKindValue(value)
                    const found = COMMON_KINDS.find((entry) => entry.value === value)
                    if (found && namePatternValue === "Room {sequence}") {
                      setNamePatternValue(found.defaultPattern)
                    }
                  }}
                  disabled={editingKind !== null}
                >
                  <SelectTrigger id="resource-template-kind" className="w-full">
                    <SelectValue placeholder={t.kindPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_KINDS.map((entry) => (
                      <SelectItem key={entry.value} value={entry.value}>
                        {t.kinds[entry.value]}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">{t.kindCustomOption}</SelectItem>
                  </SelectContent>
                </Select>
                {isExtendedKind || editingKind ? (
                  <Input
                    value={kindValue}
                    onChange={(event) => setKindValue(event.target.value)}
                    placeholder={t.kindCustomInputPlaceholder}
                    disabled={editingKind !== null}
                  />
                ) : null}
              </div>
              {kindValue === "vehicle_seat" ? (
                <div className="grid gap-1.5">
                  <Label>{t.seatMapLabel}</Label>
                  {layoutSpec ? (
                    <div className="flex items-center gap-2 rounded-md border p-3">
                      <Armchair className="size-4 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1 text-sm">
                        {formatMessage(t.seatMapSummary, {
                          rows: layoutSpec.rows.length,
                          count: derivedSeatCount,
                        })}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSeatMapOpen(true)}
                      >
                        <Pencil className="mr-1 size-3.5" aria-hidden="true" />
                        {t.seatMapEditButton}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-md border border-dashed p-3 text-sm">
                      <p className="text-muted-foreground">{t.seatMapEmpty}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSeatMapOpen(true)}
                      >
                        <Armchair className="mr-1 size-3.5" aria-hidden="true" />
                        {t.seatMapEditButton}
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="resource-template-capacity">{t.capacityLabel}</Label>
                <Input
                  id="resource-template-capacity"
                  type="number"
                  min={1}
                  value={usingSeatMap ? derivedSeatCount : capacityValue}
                  onChange={(event) => setCapacityValue(Number(event.target.value) || 1)}
                  disabled={usingSeatMap}
                />
                {usingSeatMap ? (
                  <p className="text-muted-foreground text-xs">
                    {formatMessage(t.capacityDerivedHint, { count: derivedSeatCount })}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="resource-template-count">{t.defaultCountLabel}</Label>
                <Input
                  id="resource-template-count"
                  type="number"
                  min={0}
                  value={defaultCountValue}
                  onChange={(event) => setDefaultCountValue(Number(event.target.value) || 0)}
                />
                <p className="text-muted-foreground text-xs">{t.defaultCountHint}</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="resource-template-pattern">{t.namePatternLabel}</Label>
                <Input
                  id="resource-template-pattern"
                  value={namePatternValue}
                  onChange={(event) => setNamePatternValue(event.target.value)}
                  placeholder={t.namePatternPlaceholder}
                />
                <p className="text-muted-foreground text-xs">
                  {(() => {
                    const [before, after] = t.namePatternHint.split("{placeholder}")
                    return (
                      <>
                        {before}
                        <code>{"{sequence}"}</code>
                        {after}
                      </>
                    )
                  })()}
                </p>
              </div>
              {error ? <p className="text-destructive text-xs">{error}</p> : null}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                {editingKind ? t.save : t.createButton}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={seatMapOpen} onOpenChange={setSeatMapOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t.seatMapDialogTitle}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <SeatMapBuilder value={layoutSpec} onChange={setLayoutSpec} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" onClick={() => setSeatMapOpen(false)}>
              {t.seatMapDialogDone}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  )
}

function SeatMapSummaryBadge({
  flags,
  messages,
}: {
  flags: Record<string, unknown>
  messages: { seatMapSummary: string }
}) {
  const spec = extractLayoutSpec(flags)
  if (!spec) return null
  return (
    <Badge variant="outline" className="text-[10px]">
      {formatMessage(messages.seatMapSummary, {
        rows: spec.rows.length,
        count: countSeats(spec),
      })}
    </Badge>
  )
}

function extractLayoutSpec(
  flags: Record<string, unknown> | null | undefined,
): SeatLayoutSpec | null {
  const raw = flags?.layoutSpec
  if (!raw) return null
  // Validate against the schema rather than trust the shape — the server
  // stores flags as opaque JSON, so a malformed value (e.g. a row missing
  // `cells`) could otherwise reach `countSeats` and throw at runtime.
  const parsed = seatLayoutSpecSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

function countSeats(spec: SeatLayoutSpec | null): number {
  if (!spec) return 0
  let count = 0
  for (const row of spec.rows) {
    for (const cell of row.cells) {
      if (cell === "seat") count += 1
    }
  }
  return count
}
