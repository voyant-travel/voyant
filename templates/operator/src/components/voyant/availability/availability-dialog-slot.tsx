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
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import type {
  AvailabilityRuleRow,
  AvailabilitySlotRow,
  AvailabilityStartTimeRow,
  ProductOption,
} from "@/components/voyant/availability/availability-shared"
import {
  booleanOptions,
  NONE_VALUE,
  nullableNumber,
  nullableString,
  slotStatusOptions,
  toIsoDateTime,
  toLocalDateTimeInput,
} from "@/components/voyant/availability/availability-shared"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

function getSlotFormSchema(messages: ReturnType<typeof useAdminMessages>) {
  return z.object({
    productId: z.string().min(1, messages.availability.dialogs.slot.validationProductRequired),
    availabilityRuleId: z.string().optional(),
    startTimeId: z.string().optional(),
    dateLocal: z.string().min(1, messages.availability.dialogs.slot.validationDateRequired),
    startsAt: z.string().min(1, messages.availability.dialogs.slot.validationStartsAtRequired),
    endsAt: z.string().optional(),
    timezone: z.string().min(1, messages.availability.dialogs.slot.validationTimezoneRequired),
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

export function AvailabilitySlotDialog({
  open,
  onOpenChange,
  slot,
  products,
  rules,
  startTimes,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  slot?: AvailabilitySlotRow
  products: ProductOption[]
  rules: AvailabilityRuleRow[]
  startTimes: AvailabilityStartTimeRow[]
  onSuccess: () => void
}) {
  const messages = useAdminMessages()
  const slotMessages = messages.availability.dialogs.slot
  const slotFormSchema = getSlotFormSchema(messages)
  const form = useForm<SlotFormValues, unknown, SlotFormOutput>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: {
      productId: "",
      availabilityRuleId: NONE_VALUE,
      startTimeId: NONE_VALUE,
      dateLocal: "",
      startsAt: "",
      endsAt: "",
      timezone: "Europe/Bucharest",
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
    if (open && slot) {
      form.reset({
        productId: slot.productId,
        availabilityRuleId: slot.availabilityRuleId ?? NONE_VALUE,
        startTimeId: slot.startTimeId ?? NONE_VALUE,
        dateLocal: slot.dateLocal,
        startsAt: toLocalDateTimeInput(slot.startsAt),
        endsAt: toLocalDateTimeInput(slot.endsAt),
        timezone: slot.timezone,
        status: slot.status,
        unlimited: slot.unlimited,
        initialPax: slot.initialPax?.toString() ?? "",
        remainingPax: slot.remainingPax?.toString() ?? "",
        initialPickups: "",
        remainingPickups: "",
        remainingResources: "",
        pastCutoff: false,
        tooEarly: false,
        notes: slot.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, slot])

  const selectedProductId = form.watch("productId")
  const filteredRules = rules.filter((rule) => rule.productId === selectedProductId)
  const filteredStartTimes = startTimes.filter(
    (startTime) => startTime.productId === selectedProductId,
  )
  const isEditing = Boolean(slot)

  const onSubmit = async (values: SlotFormOutput) => {
    const payload = {
      productId: values.productId,
      availabilityRuleId:
        values.availabilityRuleId === NONE_VALUE ? null : values.availabilityRuleId,
      startTimeId: values.startTimeId === NONE_VALUE ? null : values.startTimeId,
      dateLocal: values.dateLocal,
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: toIsoDateTime(values.endsAt),
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
    }

    if (isEditing) {
      await api.patch(`/v1/availability/slots/${slot?.id}`, payload)
    } else {
      await api.post("/v1/availability/slots", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? slotMessages.editTitle : slotMessages.newTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>{slotMessages.productLabel}</Label>
              <Select
                items={products.map((product) => ({ label: product.name, value: product.id }))}
                value={form.watch("productId")}
                onValueChange={(value) => form.setValue("productId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={slotMessages.selectProductPlaceholder} />
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
                <Input {...form.register("dateLocal")} type="date" />
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
                <Input {...form.register("startsAt")} type="datetime-local" />
              </div>
              <div className="grid gap-2">
                <Label>{slotMessages.endsAtLabel}</Label>
                <Input {...form.register("endsAt")} type="datetime-local" />
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
                            open: messages.availability.statusOpen,
                            closed: messages.availability.statusClosed,
                            sold_out: messages.availability.statusSoldOut,
                            cancelled: messages.availability.statusCancelled,
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
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{slotMessages.pastCutoffTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {slotMessages.pastCutoffDescription}
                  </p>
                </div>
                <Switch
                  checked={form.watch("pastCutoff")}
                  onCheckedChange={(checked) => form.setValue("pastCutoff", checked)}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{slotMessages.tooEarlyTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {slotMessages.tooEarlyDescription}
                  </p>
                </div>
                <Switch
                  checked={form.watch("tooEarly")}
                  onCheckedChange={(checked) => form.setValue("tooEarly", checked)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>{slotMessages.notesLabel}</Label>
              <Textarea {...form.register("notes")} placeholder={slotMessages.notesPlaceholder} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {slotMessages.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? slotMessages.save : slotMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
