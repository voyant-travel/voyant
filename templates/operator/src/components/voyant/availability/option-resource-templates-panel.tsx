"use client"

import {
  useProductResourceTemplates,
  useResourceTemplateMutation,
} from "@voyantjs/availability-react"
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
import { Bed, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

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

const COMMON_KINDS: ReadonlyArray<{ value: string; label: string; defaultPattern: string }> = [
  { value: "room", label: "Room", defaultPattern: "Room {sequence}" },
  { value: "vehicle_seat", label: "Vehicle seat", defaultPattern: "Seat {sequence}" },
  { value: "cabin", label: "Cabin", defaultPattern: "Cabin {sequence}" },
  { value: "flight_seat", label: "Flight seat", defaultPattern: "Seat {sequence}" },
]

export function OptionResourceTemplatesPanel({
  productId,
  optionId,
}: OptionResourceTemplatesPanelProps) {
  const { data, isPending, isError } = useProductResourceTemplates({ productId })
  const { upsert, remove } = useResourceTemplateMutation(productId)

  const templates = useMemo(() => {
    const option = (data?.data ?? []).find((entry) => entry.id === optionId)
    return option?.templates ?? []
  }, [data?.data, optionId])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingKind, setEditingKind] = useState<string | null>(null)
  const [kindValue, setKindValue] = useState<string>("room")
  const [capacityValue, setCapacityValue] = useState<number>(2)
  const [namePatternValue, setNamePatternValue] = useState<string>("Room {sequence}")
  const [error, setError] = useState<string | null>(null)

  function openCreate() {
    setEditingKind(null)
    setKindValue("room")
    setCapacityValue(2)
    setNamePatternValue("Room {sequence}")
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(template: { kind: string; capacity: number; namePattern: string }) {
    setEditingKind(template.kind)
    setKindValue(template.kind)
    setCapacityValue(template.capacity)
    setNamePatternValue(template.namePattern)
    setError(null)
    setDialogOpen(true)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const trimmedKind = kindValue.trim()
    const trimmedPattern = namePatternValue.trim()
    if (!trimmedKind || !trimmedPattern || capacityValue < 1) {
      setError("Capacity must be at least 1; kind and name pattern are required.")
      return
    }
    try {
      await upsert.mutateAsync({
        optionId,
        kind: trimmedKind,
        input: {
          capacity: capacityValue,
          namePattern: trimmedPattern,
        },
      })
      setDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    }
  }

  async function handleRemove(kind: string) {
    if (!globalThis.confirm?.(`Delete the "${kind}" template for this option?`)) return
    try {
      await remove.mutateAsync({ optionId, kind })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
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
            Resource templates
          </CardTitle>
          <CardDescription>
            Define how this option maps to physical resources (rooms, seats, cabins). "Generate
            resources" on the Allocation tab uses these to materialize the right number of resources
            per slot.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" aria-hidden="true" />
          Add template
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isPending ? (
          <p className="flex items-center justify-center gap-2 px-6 py-6 text-muted-foreground text-sm">
            <Loader2 className="size-3.5 animate-spin" />
          </p>
        ) : isError ? (
          <p className="px-6 py-6 text-center text-destructive text-sm">
            Could not load templates.
          </p>
        ) : templates.length === 0 ? (
          <p className="px-6 py-6 text-center text-muted-foreground text-sm">
            No resource templates yet. Add one so "Generate resources" knows what to create.
          </p>
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
                      Capacity {template.capacity} · {template.namePattern}
                    </span>
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
              {editingKind ? `Edit "${editingKind}" template` : "Add resource template"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit}>
            <DialogBody className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="resource-template-kind">Kind</Label>
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
                    <SelectValue placeholder="Select a kind…" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_KINDS.map((entry) => (
                      <SelectItem key={entry.value} value={entry.value}>
                        {entry.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                {isExtendedKind || editingKind ? (
                  <Input
                    value={kindValue}
                    onChange={(event) => setKindValue(event.target.value)}
                    placeholder="custom_kind"
                    disabled={editingKind !== null}
                  />
                ) : null}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="resource-template-capacity">Capacity</Label>
                <Input
                  id="resource-template-capacity"
                  type="number"
                  min={1}
                  value={capacityValue}
                  onChange={(event) => setCapacityValue(Number(event.target.value) || 1)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="resource-template-pattern">Name pattern</Label>
                <Input
                  id="resource-template-pattern"
                  value={namePatternValue}
                  onChange={(event) => setNamePatternValue(event.target.value)}
                  placeholder="Room {sequence}"
                />
                <p className="text-muted-foreground text-xs">
                  Use <code>{"{sequence}"}</code> as a placeholder for the auto-numbered index.
                </p>
              </div>
              {error ? <p className="text-destructive text-xs">{error}</p> : null}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                {editingKind ? "Save" : "Create template"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
