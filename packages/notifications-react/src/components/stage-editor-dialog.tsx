"use client"

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@voyant-travel/ui/components"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@voyant-travel/ui/components/field"
import { Switch } from "@voyant-travel/ui/components/switch"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"
import { type ReminderRuleStageRecord, useReminderRuleStageMutation } from "../index.js"

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
const DEFAULT_MAX_SENDS_IN_STAGE = 1

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
      maxSendsInStage: DEFAULT_MAX_SENDS_IN_STAGE,
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
    maxSendsInStage: stage.maxSendsInStage ?? DEFAULT_MAX_SENDS_IN_STAGE,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? messages.stage.titles.edit : messages.stage.titles.create}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <FieldGroup>
            {/* Identity */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_8rem]">
              <Field>
                <FieldLabel htmlFor="stage-name">{messages.stage.fields.name}</FieldLabel>
                <Input
                  id="stage-name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder={messages.stage.placeholders.name}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="stage-order">{messages.stage.fields.orderIndex}</FieldLabel>
                <Input
                  id="stage-order"
                  type="number"
                  value={form.orderIndex}
                  onChange={(e) => setField("orderIndex", Number(e.target.value))}
                />
              </Field>
            </div>

            {/* Window */}
            <FieldSet>
              <FieldLegend variant="label">{messages.stage.fields.anchor}</FieldLegend>
              <FieldDescription>{messages.stage.descriptions.window}</FieldDescription>
              <FieldGroup className="gap-4">
                <Field>
                  <Select
                    value={form.anchor}
                    onValueChange={(v) => setField("anchor", v as Anchor)}
                  >
                    <SelectTrigger className="w-full">
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
                </Field>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="window-start">
                      {messages.stage.fields.windowStartDays}
                    </FieldLabel>
                    <Input
                      id="window-start"
                      type="number"
                      value={form.windowStartDays}
                      onChange={(e) => setField("windowStartDays", Number(e.target.value))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="window-end">
                      {messages.stage.fields.windowEndDays}
                    </FieldLabel>
                    <Input
                      id="window-end"
                      type="number"
                      value={form.windowEndDays}
                      onChange={(e) => setField("windowEndDays", Number(e.target.value))}
                    />
                  </Field>
                </div>
              </FieldGroup>
            </FieldSet>

            {/* Cadence */}
            <FieldSet>
              <FieldLegend variant="label">{messages.stage.fields.cadenceKind}</FieldLegend>
              <FieldDescription>{messages.stage.descriptions.cadence}</FieldDescription>
              <FieldGroup className="gap-4">
                <Field>
                  <Select
                    value={form.cadenceKind}
                    onValueChange={(v) => setField("cadenceKind", v as CadenceKind)}
                  >
                    <SelectTrigger className="w-full">
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
                </Field>

                {form.cadenceKind === "every_n_days" && (
                  <Field>
                    <FieldLabel htmlFor="cadence-every">
                      {messages.stage.fields.cadenceEveryDays}
                    </FieldLabel>
                    <Input
                      id="cadence-every"
                      type="number"
                      min={1}
                      value={form.cadenceEveryDays ?? ""}
                      onChange={(e) =>
                        setField("cadenceEveryDays", e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </Field>
                )}

                {form.cadenceKind === "escalating" && (
                  <Field>
                    <div className="flex items-center justify-between">
                      <FieldLabel>{messages.stage.fields.cadenceIntervals}</FieldLabel>
                      <Button type="button" size="sm" variant="outline" onClick={addInterval}>
                        <Plus className="size-4" />
                        {messages.stage.intervalRow.addInterval}
                      </Button>
                    </div>
                    {form.cadenceIntervals.length === 0 ? (
                      <FieldDescription>
                        {messages.stage.descriptions.emptyIntervals}
                      </FieldDescription>
                    ) : null}
                    <div className="space-y-2">
                      {form.cadenceIntervals.map((interval) => (
                        <div
                          key={interval.rowKey}
                          className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
                        >
                          <Field>
                            <FieldLabel className="text-xs">
                              {messages.stage.intervalRow.whenDaysUntilDueGT}
                            </FieldLabel>
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
                          </Field>
                          <Field>
                            <FieldLabel className="text-xs">
                              {messages.stage.intervalRow.repeatEveryDays}
                            </FieldLabel>
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
                          </Field>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeInterval(interval.rowKey)}
                            aria-label={messages.stage.intervalRow.removeInterval}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Field>
                )}
              </FieldGroup>
            </FieldSet>

            {/* Stop conditions + behaviour */}
            <FieldSet>
              <FieldLegend variant="label">
                {messages.stage.descriptions.stopConditions}
              </FieldLegend>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="max-sends">
                    {messages.stage.fields.maxSendsInStage}
                  </FieldLabel>
                  <Input
                    id="max-sends"
                    type="number"
                    min={1}
                    value={form.maxSendsInStage ?? ""}
                    onChange={(e) =>
                      setField("maxSendsInStage", e.target.value ? Number(e.target.value) : null)
                    }
                    placeholder={messages.common.optionalPlaceholder}
                  />
                  <FieldDescription>{messages.stage.descriptions.maxSendsInStage}</FieldDescription>
                </Field>

                <Field orientation="horizontal">
                  <Switch
                    id="respect-quiet-hours"
                    checked={form.respectQuietHours}
                    onCheckedChange={(v) => setField("respectQuietHours", Boolean(v))}
                  />
                  <FieldLabel htmlFor="respect-quiet-hours" className="!w-auto !flex-row">
                    <FieldTitle>{messages.stage.fields.respectQuietHours}</FieldTitle>
                    <FieldDescription>
                      {messages.stage.descriptions.respectQuietHours}
                    </FieldDescription>
                  </FieldLabel>
                </Field>
              </FieldGroup>
            </FieldSet>
          </FieldGroup>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {messages.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? messages.common.save : messages.common.create}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
