"use client"

import { SeatMapBuilder } from "@voyantjs/allocation-ui"
import {
  type SeatLayoutSpec,
  useProductResourceTemplates,
  useResourceTemplateMutation,
} from "@voyantjs/availability-react"
import { formatMessage } from "@voyantjs/i18n"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Armchair, Bed, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
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

export function OptionResourceTemplatesPanel({
  productId,
  optionId,
}: OptionResourceTemplatesPanelProps) {
  const adminMessages = useAdminMessages()
  const t = adminMessages.availability.details.resourceTemplates
  const { data, isPending, isError } = useProductResourceTemplates({ productId })
  const { upsert, remove } = useResourceTemplateMutation(productId)

  const templates = useMemo(() => {
    const option = (data?.data ?? []).find((entry) => entry.id === optionId)
    return option?.templates ?? []
  }, [data?.data, optionId])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [seatMapOpen, setSeatMapOpen] = useState(false)
  const [editingKind, setEditingKind] = useState<string | null>(null)
  const [kindValue, setKindValue] = useState<string>("room")
  const [capacityValue, setCapacityValue] = useState<number>(2)
  const [namePatternValue, setNamePatternValue] = useState<string>("Room {sequence}")
  const [layoutSpec, setLayoutSpec] = useState<SeatLayoutSpec | null>(null)
  const [error, setError] = useState<string | null>(null)

  const derivedSeatCount = useMemo(() => countSeats(layoutSpec), [layoutSpec])
  const usingSeatMap = kindValue === "vehicle_seat" && layoutSpec !== null

  function openCreate() {
    setEditingKind(null)
    setKindValue("room")
    setCapacityValue(2)
    setNamePatternValue("Room {sequence}")
    setLayoutSpec(null)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(template: {
    kind: string
    capacity: number
    namePattern: string
    flags: Record<string, unknown>
  }) {
    setEditingKind(template.kind)
    setKindValue(template.kind)
    setCapacityValue(template.capacity)
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

  const matchingCommon = COMMON_KINDS.find((entry) => entry.value === kindValue)
  const isExtendedKind = !matchingCommon && kindValue.trim().length > 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bed className="size-4 text-muted-foreground" aria-hidden="true" />
            {t.title}
          </CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" aria-hidden="true" />
          {t.addButton}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isPending ? (
          <p className="flex items-center justify-center gap-2 px-6 py-6 text-muted-foreground text-sm">
            <Loader2 className="size-3.5 animate-spin" />
          </p>
        ) : isError ? (
          <p className="px-6 py-6 text-center text-destructive text-sm">{t.loadFailed}</p>
        ) : templates.length === 0 ? (
          <p className="px-6 py-6 text-center text-muted-foreground text-sm">{t.emptyMessage}</p>
        ) : (
          <ul className="divide-y">
            {templates.map((template) => (
              <li key={template.kind} className="flex items-center justify-between gap-3 px-6 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {template.kind}
                    </Badge>
                    <span className="text-sm">
                      {formatMessage(t.capacitySummary, {
                        capacity: template.capacity,
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
      </CardContent>

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
    </Card>
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
  if (!raw || typeof raw !== "object") return null
  // The server validates layoutSpec on read; we trust the manifest shape here
  // and only reject if the runtime object is obviously not a spec.
  const candidate = raw as { rows?: unknown }
  if (!Array.isArray(candidate.rows)) return null
  return candidate as SeatLayoutSpec
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
