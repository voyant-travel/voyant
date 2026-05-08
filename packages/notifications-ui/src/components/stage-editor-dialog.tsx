"use client"

import {
  type ReminderRuleStageRecord,
  useReminderRuleStageMutation,
} from "@voyantjs/notifications-react"
import {
  Button,
  Checkbox,
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
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"

type CadenceKind = "once" | "every_n_days" | "escalating"
type Anchor = ReminderRuleStageRecord["anchor"]

type IntervalRow = {
  rowKey: string
  whenDaysUntilDueGT: number | null
  repeatEveryDays: number
}

type FormState = {
  name: string
  orderIndex: number
  anchor: Anchor
  windowStartDays: number
  windowEndDays: number
  cadenceKind: CadenceKind
  cadenceEveryDays: number | null
  cadenceIntervals: IntervalRow[]
  maxSendsInStage: number | null
  respectQuietHours: boolean
}

let intervalRowSeq = 0
const nextIntervalRowKey = () => `iv-${++intervalRowSeq}`

const ANCHORS: Anchor[] = [
  "due_date",
  "booking_created_at",
  "departure_date",
  "invoice_issued_at",
  "last_send_at",
]

const CADENCES: CadenceKind[] = ["once", "every_n_days", "escalating"]

function fromRecord(stage: ReminderRuleStageRecord | null, orderIndex: number): FormState {
  if (!stage) {
    return {
      name: "",
      orderIndex,
      anchor: "due_date",
      windowStartDays: -7,
      windowEndDays: 0,
      cadenceKind: "once",
      cadenceEveryDays: null,
      cadenceIntervals: [],
      maxSendsInStage: null,
      respectQuietHours: true,
    }
  }
  return {
    name: stage.name ?? "",
    orderIndex: stage.orderIndex,
    anchor: stage.anchor,
    windowStartDays: stage.windowStartDays,
    windowEndDays: stage.windowEndDays,
    cadenceKind: stage.cadenceKind,
    cadenceEveryDays: stage.cadenceEveryDays,
    cadenceIntervals:
      stage.cadenceIntervals?.map((i) => ({
        rowKey: nextIntervalRowKey(),
        whenDaysUntilDueGT: i.whenDaysUntilDueGT ?? null,
        repeatEveryDays: i.repeatEveryDays,
      })) ?? [],
    maxSendsInStage: stage.maxSendsInStage,
    respectQuietHours: stage.respectQuietHours,
  }
}

export interface StageEditorDialogProps {
  reminderRuleId: string
  stage: ReminderRuleStageRecord | null
  defaultOrderIndex?: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StageEditorDialog({
  reminderRuleId,
  stage,
  defaultOrderIndex = 0,
  open,
  onOpenChange,
}: StageEditorDialogProps) {
  const messages = useNotificationsUiMessagesOrDefault()
  const { create, update } = useReminderRuleStageMutation(reminderRuleId)
  const [form, setForm] = useState<FormState>(() => fromRecord(stage, defaultOrderIndex))
  const isEdit = Boolean(stage)
  const isPending = create.isPending || update.isPending

  useEffect(() => {
    if (open) setForm(fromRecord(stage, defaultOrderIndex))
  }, [open, stage, defaultOrderIndex])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const addInterval = () =>
    setField("cadenceIntervals", [
      ...form.cadenceIntervals,
      { rowKey: nextIntervalRowKey(), whenDaysUntilDueGT: null, repeatEveryDays: 7 },
    ])
  const removeInterval = (rowKey: string) =>
    setField(
      "cadenceIntervals",
      form.cadenceIntervals.filter((row) => row.rowKey !== rowKey),
    )

  const handleSubmit = async () => {
    const input = {
      name: form.name || null,
      orderIndex: form.orderIndex,
      anchor: form.anchor,
      windowStartDays: form.windowStartDays,
      windowEndDays: form.windowEndDays,
      cadenceKind: form.cadenceKind,
      cadenceEveryDays: form.cadenceKind === "every_n_days" ? form.cadenceEveryDays : null,
      cadenceIntervals:
        form.cadenceKind === "escalating"
          ? form.cadenceIntervals.map((row) => ({
              whenDaysUntilDueGT: row.whenDaysUntilDueGT,
              repeatEveryDays: row.repeatEveryDays,
            }))
          : null,
      maxSendsInStage: form.maxSendsInStage,
      respectQuietHours: form.respectQuietHours,
    }
    if (isEdit && stage) {
      await update.mutateAsync({ stageId: stage.id, input })
    } else {
      await create.mutateAsync(input)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? messages.stage.titles.edit : messages.stage.titles.create}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{messages.stage.fields.name}</Label>
              <Input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder={messages.stage.placeholders.name}
              />
            </div>
            <div>
              <Label>{messages.stage.fields.orderIndex}</Label>
              <Input
                type="number"
                value={form.orderIndex}
                onChange={(e) => setField("orderIndex", Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <Label>{messages.stage.fields.anchor}</Label>
            <Select value={form.anchor} onValueChange={(v) => setField("anchor", v as Anchor)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANCHORS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {messages.stage.anchors[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{messages.stage.fields.windowStartDays}</Label>
              <Input
                type="number"
                value={form.windowStartDays}
                onChange={(e) => setField("windowStartDays", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>{messages.stage.fields.windowEndDays}</Label>
              <Input
                type="number"
                value={form.windowEndDays}
                onChange={(e) => setField("windowEndDays", Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <Label>{messages.stage.fields.cadenceKind}</Label>
            <Select
              value={form.cadenceKind}
              onValueChange={(v) => setField("cadenceKind", v as CadenceKind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CADENCES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {messages.stage.cadences[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.cadenceKind === "every_n_days" && (
            <div>
              <Label>{messages.stage.fields.cadenceEveryDays}</Label>
              <Input
                type="number"
                min={1}
                value={form.cadenceEveryDays ?? ""}
                onChange={(e) =>
                  setField("cadenceEveryDays", e.target.value ? Number(e.target.value) : null)
                }
              />
            </div>
          )}

          {form.cadenceKind === "escalating" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{messages.stage.fields.cadenceIntervals}</Label>
                <Button type="button" size="sm" variant="outline" onClick={addInterval}>
                  <Plus className="size-4" /> {messages.stage.intervalRow.addInterval}
                </Button>
              </div>
              {form.cadenceIntervals.map((interval) => (
                <div
                  key={interval.rowKey}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"
                >
                  <div>
                    <Label className="text-xs">
                      {messages.stage.intervalRow.whenDaysUntilDueGT}
                    </Label>
                    <Input
                      type="number"
                      value={interval.whenDaysUntilDueGT ?? ""}
                      onChange={(e) =>
                        setField(
                          "cadenceIntervals",
                          form.cadenceIntervals.map((row) =>
                            row.rowKey === interval.rowKey
                              ? {
                                  ...row,
                                  whenDaysUntilDueGT: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                }
                              : row,
                          ),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{messages.stage.intervalRow.repeatEveryDays}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={interval.repeatEveryDays}
                      onChange={(e) =>
                        setField(
                          "cadenceIntervals",
                          form.cadenceIntervals.map((row) =>
                            row.rowKey === interval.rowKey
                              ? { ...row, repeatEveryDays: Number(e.target.value) }
                              : row,
                          ),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeInterval(interval.rowKey)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{messages.stage.fields.maxSendsInStage}</Label>
              <Input
                type="number"
                min={1}
                value={form.maxSendsInStage ?? ""}
                onChange={(e) =>
                  setField("maxSendsInStage", e.target.value ? Number(e.target.value) : null)
                }
                placeholder={messages.common.optionalPlaceholder}
              />
            </div>
            <div className="flex items-end gap-2">
              <Checkbox
                id="respectQuietHours"
                checked={form.respectQuietHours}
                onCheckedChange={(v) => setField("respectQuietHours", Boolean(v))}
              />
              <Label htmlFor="respectQuietHours">{messages.stage.fields.respectQuietHours}</Label>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {messages.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? messages.common.save : messages.common.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
