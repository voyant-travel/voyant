"use client"

import {
  Button,
  Input,
  Label,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
} from "@voyant-travel/ui/components"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { usePricingUiMessagesOrDefault } from "../i18n/provider.js"
import { type PriceScheduleRecord, usePriceScheduleMutation } from "../index.js"
import { PriceCatalogCombobox } from "./price-catalog-combobox.js"
import { RecurrenceRulePicker } from "./recurrence-rule-picker.js"

function createScheduleFormSchema(messages: ReturnType<typeof usePricingUiMessagesOrDefault>) {
  return z.object({
    priceCatalogId: z.string().min(1, messages.priceScheduleDialog.validation.catalogRequired),
    name: z.string().min(1, messages.priceScheduleDialog.validation.nameRequired).max(255),
    code: z.string().max(100).optional().nullable(),
    recurrenceRule: z
      .string()
      .min(1, messages.priceScheduleDialog.validation.recurrenceRuleRequired),
    timezone: z.string().max(100).optional().nullable(),
    validFrom: z.string().optional().nullable(),
    validTo: z.string().optional().nullable(),
    priority: z.coerce.number().int(),
    active: z.boolean(),
    notes: z.string().optional().nullable(),
  })
}

type ScheduleFormSchema = ReturnType<typeof createScheduleFormSchema>
type ScheduleFormValues = z.input<ScheduleFormSchema>
type ScheduleFormOutput = z.output<ScheduleFormSchema>

export interface PriceScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule?: PriceScheduleRecord
  onSuccess?: (schedule: PriceScheduleRecord) => void
}

export function PriceScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onSuccess,
}: PriceScheduleDialogProps) {
  const isEditing = !!schedule
  const { create, update } = usePriceScheduleMutation()
  const messages = usePricingUiMessagesOrDefault()
  const scheduleFormSchema = createScheduleFormSchema(messages)

  const form = useForm<ScheduleFormValues, unknown, ScheduleFormOutput>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      priceCatalogId: "",
      name: "",
      code: "",
      recurrenceRule: messages.priceScheduleDialog.placeholders.recurrenceRule,
      timezone: "",
      validFrom: "",
      validTo: "",
      priority: 0,
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && schedule) {
      form.reset({
        priceCatalogId: schedule.priceCatalogId,
        name: schedule.name,
        code: schedule.code ?? "",
        recurrenceRule: schedule.recurrenceRule,
        timezone: schedule.timezone ?? "",
        validFrom: schedule.validFrom ?? "",
        validTo: schedule.validTo ?? "",
        priority: schedule.priority,
        active: schedule.active,
        notes: schedule.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, schedule, form])

  const onSubmit = async (values: ScheduleFormOutput) => {
    const payload = {
      priceCatalogId: values.priceCatalogId,
      name: values.name,
      code: values.code || null,
      recurrenceRule: values.recurrenceRule,
      timezone: values.timezone || null,
      validFrom: values.validFrom || null,
      validTo: values.validTo || null,
      priority: values.priority,
      active: values.active,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: schedule.id, input: payload })
      : await create.mutateAsync(payload)

    onSuccess?.(saved)
    onOpenChange(false)
  }

  const validFrom = form.watch("validFrom")
  const validTo = form.watch("validTo")
  const isSubmitting = create.isPending || update.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? messages.priceScheduleDialog.titles.edit
              : messages.priceScheduleDialog.titles.create}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{messages.priceScheduleDialog.fields.catalog}</Label>
              <PriceCatalogCombobox
                value={form.watch("priceCatalogId")}
                onChange={(value) =>
                  form.setValue("priceCatalogId", value ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder={messages.priceScheduleDialog.placeholders.catalog}
              />
              {form.formState.errors.priceCatalogId ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.priceCatalogId.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.priceScheduleDialog.fields.name}</Label>
                <Input
                  {...form.register("name")}
                  placeholder={messages.priceScheduleDialog.placeholders.name}
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.priceScheduleDialog.fields.code}</Label>
                <Input
                  {...form.register("code")}
                  placeholder={messages.priceScheduleDialog.placeholders.code}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.priceScheduleDialog.fields.recurrenceRule}</Label>
              <RecurrenceRulePicker
                value={form.watch("recurrenceRule")}
                onChange={(rule) =>
                  form.setValue("recurrenceRule", rule, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              {form.formState.errors.recurrenceRule ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.recurrenceRule.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.priceScheduleDialog.fields.validFrom}</Label>
                <DatePicker
                  value={typeof validFrom === "string" && validFrom.length > 0 ? validFrom : null}
                  onChange={(value) =>
                    form.setValue("validFrom", value ?? "", { shouldDirty: true })
                  }
                  placeholder={messages.priceScheduleDialog.placeholders.validFrom}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.priceScheduleDialog.fields.validTo}</Label>
                <DatePicker
                  value={typeof validTo === "string" && validTo.length > 0 ? validTo : null}
                  onChange={(value) => form.setValue("validTo", value ?? "", { shouldDirty: true })}
                  placeholder={messages.priceScheduleDialog.placeholders.validTo}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.priceScheduleDialog.fields.timezone}</Label>
                <Input
                  {...form.register("timezone")}
                  placeholder={messages.priceScheduleDialog.placeholders.timezone}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.priceScheduleDialog.fields.priority}</Label>
                <Input {...form.register("priority")} type="number" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
              <Label>{messages.priceScheduleDialog.fields.active}</Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.priceScheduleDialog.fields.notes}</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing
                ? messages.common.saveChanges
                : messages.priceScheduleDialog.actions.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
