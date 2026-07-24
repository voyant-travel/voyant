"use client"

import {
  Input,
  Label,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@voyant-travel/ui/components"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "../../form-resolver.js"
import { useAvailabilityUiMessagesOrDefault } from "../../i18n/index.js"
import type { AvailabilityRuleRow, ProductOption } from "../../index.js"
import { nullableNumber } from "../../index.js"
import {
  type AvailabilityDialogMessages,
  type AvailabilityRuleSubmitPayload,
  DialogActions,
  ProductSelect,
  type SubmitContext,
  SwitchField,
} from "./shared.js"

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
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? ruleMessages.editTitle : ruleMessages.newTitle}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </SheetBody>
          <DialogActions
            cancel={ruleMessages.cancel}
            save={ruleMessages.save}
            create={ruleMessages.create}
            isEditing={isEditing}
            isSubmitting={form.formState.isSubmitting}
            onCancel={() => props.onOpenChange(false)}
          />
        </form>
      </SheetContent>
    </Sheet>
  )
}
