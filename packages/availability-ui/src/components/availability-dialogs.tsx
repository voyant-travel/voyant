"use client"

import type {
  AvailabilityCloseoutRow,
  AvailabilityPickupPointRow,
  AvailabilityRuleRow,
  AvailabilitySlotRow,
  AvailabilityStartTimeRow,
  ProductOption,
} from "@voyantjs/availability-react"
import {
  booleanOptions,
  instantToSlotLocal,
  localToInstant,
  NONE_VALUE,
  nullableNumber,
  nullableString,
  slotLocalStart,
  slotStatusOptions,
} from "@voyantjs/availability-react"
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
} from "@voyantjs/ui/components"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { DateTimePicker } from "@voyantjs/ui/components/date-time-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "../form-resolver.js"
import { useAvailabilityUiMessagesOrDefault } from "../i18n/index.js"

interface RuleDialogMessages {
  validationProductRequired: string
  validationTimezoneRequired: string
  validationRecurrenceRequired: string
  editTitle: string
  newTitle: string
  productLabel: string
  selectProductPlaceholder: string
  timezoneLabel: string
  timezonePlaceholder: string
  maxCapacityLabel: string
  recurrenceRuleLabel: string
  recurrenceRulePlaceholder: string
  maxPickupCapacityLabel: string
  minimumTotalPaxLabel: string
  cutoffMinutesLabel: string
  earlyBookingLimitMinutesLabel: string
  activeTitle: string
  activeDescription: string
  cancel: string
  save: string
  create: string
}

interface StartTimeDialogMessages {
  validationProductRequired: string
  validationStartTimeRequired: string
  editTitle: string
  newTitle: string
  productLabel: string
  selectProductPlaceholder: string
  labelLabel: string
  labelPlaceholder: string
  startTimeLabel: string
  durationMinutesLabel: string
  sortOrderLabel: string
  activeTitle: string
  activeDescription: string
  cancel: string
  save: string
  create: string
}

interface SlotDialogMessages {
  validationProductRequired: string
  validationDateRequired: string
  validationStartsAtRequired: string
  validationTimezoneRequired: string
  editTitle: string
  newTitle: string
  productLabel: string
  selectProductPlaceholder: string
  ruleLabel: string
  optionalRulePlaceholder: string
  noRule: string
  startTimeLabel: string
  optionalStartTimePlaceholder: string
  noStartTime: string
  dateLabel: string
  timezoneLabel: string
  timezonePlaceholder: string
  startsAtLabel: string
  endsAtLabel: string
  statusLabel: string
  unlimitedLabel: string
  yes: string
  no: string
  initialPaxLabel: string
  remainingPaxLabel: string
  remainingResourcesLabel: string
  initialPickupsLabel: string
  remainingPickupsLabel: string
  pastCutoffTitle: string
  pastCutoffDescription: string
  tooEarlyTitle: string
  tooEarlyDescription: string
  notesLabel: string
  notesPlaceholder: string
  cancel: string
  save: string
  create: string
}

interface CloseoutDialogMessages {
  validationProductRequired: string
  validationDateRequired: string
  editTitle: string
  newTitle: string
  productLabel: string
  selectProductPlaceholder: string
  slotLabel: string
  optionalSlotPlaceholder: string
  productLevelOption: string
  dateLabel: string
  datePlaceholder: string
  reasonLabel: string
  reasonPlaceholder: string
  cancel: string
  save: string
  create: string
}

interface PickupPointDialogMessages {
  validationProductRequired: string
  validationNameRequired: string
  editTitle: string
  newTitle: string
  productLabel: string
  selectProductPlaceholder: string
  nameLabel: string
  namePlaceholder: string
  locationTextLabel: string
  locationTextPlaceholder: string
  descriptionLabel: string
  descriptionPlaceholder: string
  activeTitle: string
  activeDescription: string
  cancel: string
  save: string
  create: string
}

export interface AvailabilityDialogMessages {
  dialogs: {
    rule: RuleDialogMessages
    startTime: StartTimeDialogMessages
    slot: SlotDialogMessages
    closeout: CloseoutDialogMessages
    pickupPoint: PickupPointDialogMessages
  }
  statusOpen: string
  statusClosed: string
  statusSoldOut: string
  statusCancelled: string
}

type SubmitContext = {
  isEditing: boolean
  id?: string
}

export type AvailabilityRuleSubmitPayload = {
  productId: string
  timezone: string
  recurrenceRule: string
  maxCapacity: number
  maxPickupCapacity: number | null
  minTotalPax: number | null
  cutoffMinutes: number | null
  earlyBookingLimitMinutes: number | null
  active: boolean
}

export type AvailabilityStartTimeSubmitPayload = {
  productId: string
  label: string | null
  startTimeLocal: string
  durationMinutes: number | null
  sortOrder: number
  active: boolean
}

export type AvailabilitySlotSubmitPayload = {
  productId: string
  availabilityRuleId: string | null
  startTimeId: string | null
  dateLocal: string
  startsAt: string
  endsAt: string | null
  timezone: string
  status: AvailabilitySlotRow["status"]
  unlimited: boolean
  initialPax: number | null
  remainingPax: number | null
  initialPickups: number | null
  remainingPickups: number | null
  remainingResources: number | null
  pastCutoff: boolean
  tooEarly: boolean
  notes: string | null
}

export type AvailabilityCloseoutSubmitPayload = {
  productId: string
  slotId: string | null
  dateLocal: string
  reason: string | null
}

export type AvailabilityPickupPointSubmitPayload = {
  productId: string
  name: string
  description: string | null
  locationText: string | null
  active: boolean
}

function getRuleFormSchema(messages: AvailabilityDialogMessages) {
  return z.object({
    productId: z.string().min(1, messages.dialogs.rule.validationProductRequired),
    timezone: z.string().min(1, messages.dialogs.rule.validationTimezoneRequired),
    recurrenceRule: z.string().min(1, messages.dialogs.rule.validationRecurrenceRequired),
    maxCapacity: z.coerce.number().int().min(0),
    maxPickupCapacity: z.string().optional(),
    minTotalPax: z.string().optional(),
    cutoffMinutes: z.string().optional(),
    earlyBookingLimitMinutes: z.string().optional(),
    active: z.boolean(),
  })
}

type RuleFormSchema = ReturnType<typeof getRuleFormSchema>
type RuleFormValues = z.input<RuleFormSchema>
type RuleFormOutput = z.output<RuleFormSchema>

export function AvailabilityRuleDialog(props: {
  messages: AvailabilityDialogMessages
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: AvailabilityRuleRow
  products: ProductOption[]
  onSubmit: (payload: AvailabilityRuleSubmitPayload, context: SubmitContext) => Promise<void> // i18n-literal-ok type annotation
  onSuccess: () => void
}) {
  useAvailabilityUiMessagesOrDefault()
  const ruleMessages = props.messages.dialogs.rule
  const ruleFormSchema = getRuleFormSchema(props.messages)
  const form = useForm<RuleFormValues, unknown, RuleFormOutput>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      productId: "",
      timezone: "Europe/Bucharest", // i18n-literal-ok IANA timezone default
      recurrenceRule: "FREQ=DAILY;INTERVAL=1", // i18n-literal-ok RRULE default
      maxCapacity: 0,
      maxPickupCapacity: "",
      minTotalPax: "",
      cutoffMinutes: "",
      earlyBookingLimitMinutes: "",
      active: true,
    },
  })

  useEffect(() => {
    if (props.open && props.rule) {
      form.reset({
        productId: props.rule.productId,
        timezone: props.rule.timezone,
        recurrenceRule: props.rule.recurrenceRule,
        maxCapacity: props.rule.maxCapacity,
        maxPickupCapacity: props.rule.maxPickupCapacity?.toString() ?? "",
        minTotalPax: "",
        cutoffMinutes: props.rule.cutoffMinutes?.toString() ?? "",
        earlyBookingLimitMinutes: "",
        active: props.rule.active,
      })
    } else if (props.open) {
      form.reset()
    }
  }, [form, props.open, props.rule])

  const isEditing = Boolean(props.rule)

  const onSubmit = async (values: RuleFormOutput) => {
    await props.onSubmit(
      {
        productId: values.productId,
        timezone: values.timezone,
        recurrenceRule: values.recurrenceRule,
        maxCapacity: values.maxCapacity,
        maxPickupCapacity: nullableNumber(values.maxPickupCapacity),
        minTotalPax: nullableNumber(values.minTotalPax),
        cutoffMinutes: nullableNumber(values.cutoffMinutes),
        earlyBookingLimitMinutes: nullableNumber(values.earlyBookingLimitMinutes),
        active: values.active,
      },
      { isEditing, id: props.rule?.id },
    )
    props.onSuccess()
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? ruleMessages.editTitle : ruleMessages.newTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <ProductSelect
              label={ruleMessages.productLabel}
              placeholder={ruleMessages.selectProductPlaceholder}
              products={props.products}
              value={form.watch("productId")}
              onValueChange={(value) => form.setValue("productId", value ?? "")}
            />
            {form.formState.errors.productId ? (
              <p className="text-xs text-destructive">{form.formState.errors.productId.message}</p>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{ruleMessages.timezoneLabel}</Label>
                <Input
                  {...form.register("timezone")}
                  placeholder={ruleMessages.timezonePlaceholder}
                />
              </div>
              <div className="grid gap-2">
                <Label>{ruleMessages.maxCapacityLabel}</Label>
                <Input {...form.register("maxCapacity")} type="number" min={0} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>{ruleMessages.recurrenceRuleLabel}</Label>
              <Textarea
                {...form.register("recurrenceRule")}
                placeholder={ruleMessages.recurrenceRulePlaceholder}
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{ruleMessages.maxPickupCapacityLabel}</Label>
                <Input {...form.register("maxPickupCapacity")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>{ruleMessages.minimumTotalPaxLabel}</Label>
                <Input {...form.register("minTotalPax")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>{ruleMessages.cutoffMinutesLabel}</Label>
                <Input {...form.register("cutoffMinutes")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>{ruleMessages.earlyBookingLimitMinutesLabel}</Label>
                <Input {...form.register("earlyBookingLimitMinutes")} type="number" min={0} />
              </div>
            </div>

            <SwitchField
              title={ruleMessages.activeTitle}
              description={ruleMessages.activeDescription}
              checked={form.watch("active")}
              onCheckedChange={(checked) => form.setValue("active", checked)}
            />
          </DialogBody>
          <DialogActions
            cancel={ruleMessages.cancel}
            save={ruleMessages.save}
            create={ruleMessages.create}
            isEditing={isEditing}
            isSubmitting={form.formState.isSubmitting}
            onCancel={() => props.onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getStartTimeFormSchema(messages: AvailabilityDialogMessages) {
  return z.object({
    productId: z.string().min(1, messages.dialogs.startTime.validationProductRequired),
    label: z.string().optional(),
    startTimeLocal: z.string().min(1, messages.dialogs.startTime.validationStartTimeRequired),
    durationMinutes: z.string().optional(),
    sortOrder: z.coerce.number().int(),
    active: z.boolean(),
  })
}

type StartTimeFormSchema = ReturnType<typeof getStartTimeFormSchema>
type StartTimeFormValues = z.input<StartTimeFormSchema>
type StartTimeFormOutput = z.output<StartTimeFormSchema>

export function AvailabilityStartTimeDialog(props: {
  messages: AvailabilityDialogMessages
  open: boolean
  onOpenChange: (open: boolean) => void
  startTime?: AvailabilityStartTimeRow
  products: ProductOption[]
  onSubmit: (payload: AvailabilityStartTimeSubmitPayload, context: SubmitContext) => Promise<void> // i18n-literal-ok type annotation
  onSuccess: () => void
}) {
  const startTimeMessages = props.messages.dialogs.startTime
  const startTimeFormSchema = getStartTimeFormSchema(props.messages)
  const form = useForm<StartTimeFormValues, unknown, StartTimeFormOutput>({
    resolver: zodResolver(startTimeFormSchema),
    defaultValues: {
      productId: "",
      label: "",
      startTimeLocal: "09:00",
      durationMinutes: "",
      sortOrder: 0,
      active: true,
    },
  })

  useEffect(() => {
    if (props.open && props.startTime) {
      form.reset({
        productId: props.startTime.productId,
        label: props.startTime.label ?? "",
        startTimeLocal: props.startTime.startTimeLocal,
        durationMinutes: props.startTime.durationMinutes?.toString() ?? "",
        sortOrder: props.startTime.sortOrder,
        active: props.startTime.active,
      })
    } else if (props.open) {
      form.reset()
    }
  }, [form, props.open, props.startTime])

  const isEditing = Boolean(props.startTime)

  const onSubmit = async (values: StartTimeFormOutput) => {
    await props.onSubmit(
      {
        productId: values.productId,
        label: nullableString(values.label),
        startTimeLocal: values.startTimeLocal,
        durationMinutes: nullableNumber(values.durationMinutes),
        sortOrder: values.sortOrder,
        active: values.active,
      },
      { isEditing, id: props.startTime?.id },
    )
    props.onSuccess()
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? startTimeMessages.editTitle : startTimeMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <ProductSelect
              label={startTimeMessages.productLabel}
              placeholder={startTimeMessages.selectProductPlaceholder}
              products={props.products}
              value={form.watch("productId")}
              onValueChange={(value) => form.setValue("productId", value ?? "")}
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{startTimeMessages.labelLabel}</Label>
                <Input
                  {...form.register("label")}
                  placeholder={startTimeMessages.labelPlaceholder}
                />
              </div>
              <div className="grid gap-2">
                <Label>{startTimeMessages.startTimeLabel}</Label>
                <Input {...form.register("startTimeLocal")} type="time" />
              </div>
              <div className="grid gap-2">
                <Label>{startTimeMessages.durationMinutesLabel}</Label>
                <Input {...form.register("durationMinutes")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>{startTimeMessages.sortOrderLabel}</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
            </div>
            <SwitchField
              title={startTimeMessages.activeTitle}
              description={startTimeMessages.activeDescription}
              checked={form.watch("active")}
              onCheckedChange={(checked) => form.setValue("active", checked)}
            />
          </DialogBody>
          <DialogActions
            cancel={startTimeMessages.cancel}
            save={startTimeMessages.save}
            create={startTimeMessages.create}
            isEditing={isEditing}
            isSubmitting={form.formState.isSubmitting}
            onCancel={() => props.onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getSlotFormSchema(messages: AvailabilityDialogMessages) {
  return z.object({
    productId: z.string().min(1, messages.dialogs.slot.validationProductRequired),
    availabilityRuleId: z.string().optional(),
    startTimeId: z.string().optional(),
    dateLocal: z.string().min(1, messages.dialogs.slot.validationDateRequired),
    startsAt: z.string().min(1, messages.dialogs.slot.validationStartsAtRequired),
    endsAt: z.string().optional(),
    timezone: z.string().min(1, messages.dialogs.slot.validationTimezoneRequired),
    status: z.enum(["open", "closed", "sold_out", "cancelled"]),
    unlimited: z.boolean(),
    initialPax: z.string().optional(),
    remainingPax: z.string().optional(),
    initialPickups: z.string().optional(),
    remainingPickups: z.string().optional(),
    remainingResources: z.string().optional(),
    pastCutoff: z.boolean(),
    tooEarly: z.boolean(),
    notes: z.string().optional(),
  })
}

type SlotFormSchema = ReturnType<typeof getSlotFormSchema>
type SlotFormValues = z.input<SlotFormSchema>
type SlotFormOutput = z.output<SlotFormSchema>

function toLocalDateTimeInput(instant: string, timezone: string) {
  const local = instantToSlotLocal(instant, timezone)
  return `${local.date}T${local.time}`
}

function localDateTimeInputToInstant(value: string, timezone: string) {
  const [date, time] = value.split("T")
  if (!date || !time) {
    throw new RangeError("Local date-time input must use YYYY-MM-DDTHH:mm")
  }
  return localToInstant({ date, time, timezone })
}

function formatSlotLocalDateTime(value: { date: string; time: string }) {
  return `${value.date} ${value.time}`
}

export function AvailabilitySlotDialog(props: {
  messages: AvailabilityDialogMessages
  open: boolean
  onOpenChange: (open: boolean) => void
  slot?: AvailabilitySlotRow
  products: ProductOption[]
  rules: AvailabilityRuleRow[]
  startTimes: AvailabilityStartTimeRow[]
  onSubmit: (payload: AvailabilitySlotSubmitPayload, context: SubmitContext) => Promise<void> // i18n-literal-ok type annotation
  onSuccess: () => void
}) {
  const slotMessages = props.messages.dialogs.slot
  const slotFormSchema = getSlotFormSchema(props.messages)
  const form = useForm<SlotFormValues, unknown, SlotFormOutput>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: {
      productId: "",
      availabilityRuleId: NONE_VALUE,
      startTimeId: NONE_VALUE,
      dateLocal: "",
      startsAt: "",
      endsAt: "",
      timezone: "Europe/Bucharest", // i18n-literal-ok IANA timezone default
      status: "open",
      unlimited: false,
      initialPax: "",
      remainingPax: "",
      initialPickups: "",
      remainingPickups: "",
      remainingResources: "",
      pastCutoff: false,
      tooEarly: false,
      notes: "",
    },
  })

  useEffect(() => {
    if (props.open && props.slot) {
      form.reset({
        productId: props.slot.productId,
        availabilityRuleId: props.slot.availabilityRuleId ?? NONE_VALUE,
        startTimeId: props.slot.startTimeId ?? NONE_VALUE,
        dateLocal: props.slot.dateLocal,
        startsAt: toLocalDateTimeInput(props.slot.startsAt, props.slot.timezone),
        endsAt: props.slot.endsAt
          ? toLocalDateTimeInput(props.slot.endsAt, props.slot.timezone)
          : "",
        timezone: props.slot.timezone,
        status: props.slot.status,
        unlimited: props.slot.unlimited,
        initialPax: props.slot.initialPax?.toString() ?? "",
        remainingPax: props.slot.remainingPax?.toString() ?? "",
        initialPickups: "",
        remainingPickups: "",
        remainingResources: "",
        pastCutoff: false,
        tooEarly: false,
        notes: props.slot.notes ?? "",
      })
    } else if (props.open) {
      form.reset()
    }
  }, [form, props.open, props.slot])

  const selectedProductId = form.watch("productId")
  const filteredRules = props.rules.filter((rule) => rule.productId === selectedProductId)
  const filteredStartTimes = props.startTimes.filter(
    (startTime) => startTime.productId === selectedProductId,
  )
  const isEditing = Boolean(props.slot)

  const onSubmit = async (values: SlotFormOutput) => {
    await props.onSubmit(
      {
        productId: values.productId,
        availabilityRuleId:
          values.availabilityRuleId === NONE_VALUE ? null : (values.availabilityRuleId ?? null),
        startTimeId: values.startTimeId === NONE_VALUE ? null : (values.startTimeId ?? null),
        dateLocal: values.dateLocal,
        startsAt: localDateTimeInputToInstant(values.startsAt, values.timezone),
        endsAt: values.endsAt ? localDateTimeInputToInstant(values.endsAt, values.timezone) : null,
        timezone: values.timezone,
        status: values.status,
        unlimited: values.unlimited,
        initialPax: nullableNumber(values.initialPax),
        remainingPax: nullableNumber(values.remainingPax),
        initialPickups: nullableNumber(values.initialPickups),
        remainingPickups: nullableNumber(values.remainingPickups),
        remainingResources: nullableNumber(values.remainingResources),
        pastCutoff: values.pastCutoff,
        tooEarly: values.tooEarly,
        notes: nullableString(values.notes),
      },
      { isEditing, id: props.slot?.id },
    )
    props.onSuccess()
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? slotMessages.editTitle : slotMessages.newTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <ProductSelect
              label={slotMessages.productLabel}
              placeholder={slotMessages.selectProductPlaceholder}
              products={props.products}
              value={form.watch("productId")}
              onValueChange={(value) => form.setValue("productId", value ?? "")}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{slotMessages.ruleLabel}</Label>
                <Select
                  value={form.watch("availabilityRuleId") ?? NONE_VALUE}
                  onValueChange={(value) =>
                    form.setValue("availabilityRuleId", value ?? NONE_VALUE)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={slotMessages.optionalRulePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{slotMessages.noRule}</SelectItem>
                    {filteredRules.map((rule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.timezone} · {rule.recurrenceRule}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{slotMessages.startTimeLabel}</Label>
                <Select
                  value={form.watch("startTimeId") ?? NONE_VALUE}
                  onValueChange={(value) => form.setValue("startTimeId", value ?? NONE_VALUE)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={slotMessages.optionalStartTimePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{slotMessages.noStartTime}</SelectItem>
                    {filteredStartTimes.map((startTime) => (
                      <SelectItem key={startTime.id} value={startTime.id}>
                        {startTime.label ?? startTime.startTimeLocal}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{slotMessages.dateLabel}</Label>
                <DatePicker
                  value={form.watch("dateLocal") || null}
                  onChange={(nextValue) =>
                    form.setValue("dateLocal", nextValue ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>{slotMessages.timezoneLabel}</Label>
                <Input
                  {...form.register("timezone")}
                  placeholder={slotMessages.timezonePlaceholder}
                />
              </div>
              <div className="grid gap-2">
                <Label>{slotMessages.startsAtLabel}</Label>
                <DateTimePicker
                  value={form.watch("startsAt") || null}
                  onChange={(nextValue) =>
                    form.setValue("startsAt", nextValue ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>{slotMessages.endsAtLabel}</Label>
                <DateTimePicker
                  value={form.watch("endsAt") || null}
                  onChange={(nextValue) =>
                    form.setValue("endsAt", nextValue ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{slotMessages.statusLabel}</Label>
                <Select
                  items={slotStatusOptions}
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as SlotFormOutput["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {slotStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {
                          {
                            open: props.messages.statusOpen,
                            closed: props.messages.statusClosed,
                            sold_out: props.messages.statusSoldOut,
                            cancelled: props.messages.statusCancelled,
                          }[option.value]
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{slotMessages.unlimitedLabel}</Label>
                <Select
                  items={booleanOptions}
                  value={String(form.watch("unlimited"))}
                  onValueChange={(value) => form.setValue("unlimited", value === "true")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {booleanOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.value === "true" ? slotMessages.yes : slotMessages.no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>{slotMessages.initialPaxLabel}</Label>
                <Input {...form.register("initialPax")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>{slotMessages.remainingPaxLabel}</Label>
                <Input {...form.register("remainingPax")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>{slotMessages.remainingResourcesLabel}</Label>
                <Input {...form.register("remainingResources")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>{slotMessages.initialPickupsLabel}</Label>
                <Input {...form.register("initialPickups")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>{slotMessages.remainingPickupsLabel}</Label>
                <Input {...form.register("remainingPickups")} type="number" min={0} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SwitchField
                title={slotMessages.pastCutoffTitle}
                description={slotMessages.pastCutoffDescription}
                checked={form.watch("pastCutoff")}
                onCheckedChange={(checked) => form.setValue("pastCutoff", checked)}
              />
              <SwitchField
                title={slotMessages.tooEarlyTitle}
                description={slotMessages.tooEarlyDescription}
                checked={form.watch("tooEarly")}
                onCheckedChange={(checked) => form.setValue("tooEarly", checked)}
              />
            </div>

            <div className="grid gap-2">
              <Label>{slotMessages.notesLabel}</Label>
              <Textarea {...form.register("notes")} placeholder={slotMessages.notesPlaceholder} />
            </div>
          </DialogBody>
          <DialogActions
            cancel={slotMessages.cancel}
            save={slotMessages.save}
            create={slotMessages.create}
            isEditing={isEditing}
            isSubmitting={form.formState.isSubmitting}
            onCancel={() => props.onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getCloseoutFormSchema(messages: AvailabilityDialogMessages) {
  return z.object({
    productId: z.string().min(1, messages.dialogs.closeout.validationProductRequired),
    slotId: z.string().optional(),
    dateLocal: z.string().min(1, messages.dialogs.closeout.validationDateRequired),
    reason: z.string().optional(),
  })
}

type CloseoutFormSchema = ReturnType<typeof getCloseoutFormSchema>
type CloseoutFormValues = z.input<CloseoutFormSchema>
type CloseoutFormOutput = z.output<CloseoutFormSchema>

export function AvailabilityCloseoutDialog(props: {
  messages: AvailabilityDialogMessages
  open: boolean
  onOpenChange: (open: boolean) => void
  closeout?: AvailabilityCloseoutRow
  products: ProductOption[]
  slots: AvailabilitySlotRow[]
  onSubmit: (payload: AvailabilityCloseoutSubmitPayload, context: SubmitContext) => Promise<void> // i18n-literal-ok type annotation
  onSuccess: () => void
}) {
  const closeoutMessages = props.messages.dialogs.closeout
  const closeoutFormSchema = getCloseoutFormSchema(props.messages)
  const form = useForm<CloseoutFormValues, unknown, CloseoutFormOutput>({
    resolver: zodResolver(closeoutFormSchema),
    defaultValues: {
      productId: "",
      slotId: NONE_VALUE,
      dateLocal: "",
      reason: "",
    },
  })

  useEffect(() => {
    if (props.open && props.closeout) {
      form.reset({
        productId: props.closeout.productId,
        slotId: props.closeout.slotId ?? NONE_VALUE,
        dateLocal: props.closeout.dateLocal,
        reason: props.closeout.reason ?? "",
      })
    } else if (props.open) {
      form.reset()
    }
  }, [form, props.closeout, props.open])

  const selectedProductId = form.watch("productId")
  const filteredSlots = props.slots.filter((slot) => slot.productId === selectedProductId)
  const isEditing = Boolean(props.closeout)

  const onSubmit = async (values: CloseoutFormOutput) => {
    await props.onSubmit(
      {
        productId: values.productId,
        slotId: values.slotId === NONE_VALUE ? null : (values.slotId ?? null),
        dateLocal: values.dateLocal,
        reason: nullableString(values.reason),
      },
      { isEditing, id: props.closeout?.id },
    )
    props.onSuccess()
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? closeoutMessages.editTitle : closeoutMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <ProductSelect
              label={closeoutMessages.productLabel}
              placeholder={closeoutMessages.selectProductPlaceholder}
              products={props.products}
              value={form.watch("productId")}
              onValueChange={(value) => form.setValue("productId", value ?? "")}
            />
            <div className="grid gap-2">
              <Label>{closeoutMessages.slotLabel}</Label>
              <Select
                value={form.watch("slotId") ?? NONE_VALUE}
                onValueChange={(value) => form.setValue("slotId", value ?? NONE_VALUE)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={closeoutMessages.optionalSlotPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>{closeoutMessages.productLevelOption}</SelectItem>
                  {filteredSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      {formatSlotLocalDateTime(slotLocalStart(slot))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{closeoutMessages.dateLabel}</Label>
              <DatePicker
                value={form.watch("dateLocal") || null}
                onChange={(nextValue) =>
                  form.setValue("dateLocal", nextValue ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder={closeoutMessages.datePlaceholder}
                className="w-full"
              />
            </div>
            <div className="grid gap-2">
              <Label>{closeoutMessages.reasonLabel}</Label>
              <Textarea
                {...form.register("reason")}
                placeholder={closeoutMessages.reasonPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogActions
            cancel={closeoutMessages.cancel}
            save={closeoutMessages.save}
            create={closeoutMessages.create}
            isEditing={isEditing}
            isSubmitting={form.formState.isSubmitting}
            onCancel={() => props.onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getPickupPointFormSchema(messages: AvailabilityDialogMessages) {
  return z.object({
    productId: z.string().min(1, messages.dialogs.pickupPoint.validationProductRequired),
    name: z.string().min(1, messages.dialogs.pickupPoint.validationNameRequired),
    description: z.string().optional(),
    locationText: z.string().optional(),
    active: z.boolean(),
  })
}

type PickupPointFormSchema = ReturnType<typeof getPickupPointFormSchema>
type PickupPointFormValues = z.input<PickupPointFormSchema>
type PickupPointFormOutput = z.output<PickupPointFormSchema>

export function AvailabilityPickupPointDialog(props: {
  messages: AvailabilityDialogMessages
  open: boolean
  onOpenChange: (open: boolean) => void
  pickupPoint?: AvailabilityPickupPointRow
  products: ProductOption[]
  onSubmit: (payload: AvailabilityPickupPointSubmitPayload, context: SubmitContext) => Promise<void> // i18n-literal-ok type annotation
  onSuccess: () => void
}) {
  const pickupPointMessages = props.messages.dialogs.pickupPoint
  const pickupPointFormSchema = getPickupPointFormSchema(props.messages)
  const form = useForm<PickupPointFormValues, unknown, PickupPointFormOutput>({
    resolver: zodResolver(pickupPointFormSchema),
    defaultValues: {
      productId: "",
      name: "",
      description: "",
      locationText: "",
      active: true,
    },
  })

  useEffect(() => {
    if (props.open && props.pickupPoint) {
      form.reset({
        productId: props.pickupPoint.productId,
        name: props.pickupPoint.name,
        description: props.pickupPoint.description ?? "",
        locationText: props.pickupPoint.locationText ?? "",
        active: props.pickupPoint.active,
      })
    } else if (props.open) {
      form.reset()
    }
  }, [form, props.open, props.pickupPoint])

  const isEditing = Boolean(props.pickupPoint)

  const onSubmit = async (values: PickupPointFormOutput) => {
    await props.onSubmit(
      {
        productId: values.productId,
        name: values.name,
        description: nullableString(values.description),
        locationText: nullableString(values.locationText),
        active: values.active,
      },
      { isEditing, id: props.pickupPoint?.id },
    )
    props.onSuccess()
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? pickupPointMessages.editTitle : pickupPointMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <ProductSelect
              label={pickupPointMessages.productLabel}
              placeholder={pickupPointMessages.selectProductPlaceholder}
              products={props.products}
              value={form.watch("productId")}
              onValueChange={(value) => form.setValue("productId", value ?? "")}
            />
            <div className="grid gap-2">
              <Label>{pickupPointMessages.nameLabel}</Label>
              <Input {...form.register("name")} placeholder={pickupPointMessages.namePlaceholder} />
            </div>
            <div className="grid gap-2">
              <Label>{pickupPointMessages.locationTextLabel}</Label>
              <Input
                {...form.register("locationText")}
                placeholder={pickupPointMessages.locationTextPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label>{pickupPointMessages.descriptionLabel}</Label>
              <Textarea
                {...form.register("description")}
                placeholder={pickupPointMessages.descriptionPlaceholder}
              />
            </div>
            <SwitchField
              title={pickupPointMessages.activeTitle}
              description={pickupPointMessages.activeDescription}
              checked={form.watch("active")}
              onCheckedChange={(checked) => form.setValue("active", checked)}
            />
          </DialogBody>
          <DialogActions
            cancel={pickupPointMessages.cancel}
            save={pickupPointMessages.save}
            create={pickupPointMessages.create}
            isEditing={isEditing}
            isSubmitting={form.formState.isSubmitting}
            onCancel={() => props.onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProductSelect({
  label,
  placeholder,
  products,
  value,
  onValueChange,
}: {
  label: string
  placeholder: string
  products: ProductOption[]
  value: string
  onValueChange: (value: string | null) => void
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select
        items={products.map((product) => ({ label: product.name, value: product.id }))}
        value={value}
        onValueChange={onValueChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {products.map((product) => (
            <SelectItem key={product.id} value={product.id}>
              {product.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function SwitchField({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function DialogActions({
  cancel,
  save,
  create,
  isEditing,
  isSubmitting,
  onCancel,
}: {
  cancel: string
  save: string
  create: string
  isEditing: boolean
  isSubmitting: boolean
  onCancel: () => void
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="ghost" onClick={onCancel}>
        {cancel}
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEditing ? save : create}
      </Button>
    </DialogFooter>
  )
}
