"use client"

import {
  Button,
  Input,
  Label,
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
  Switch,
  Textarea,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import type { StartTimeRuleMode } from "../i18n/messages.js"
import { usePricingUiMessagesOrDefault } from "../i18n/provider.js"
import { type OptionStartTimeRuleRecord, useOptionStartTimeRuleMutation } from "../index.js"
import { OptionPriceRuleCombobox } from "./option-price-rule-combobox.js"
import { ProductOptionCombobox } from "./product-option-combobox.js"

const RULE_MODES = ["included", "excluded", "override", "adjustment"] as const
type RuleMode = (typeof RULE_MODES)[number]

const ADJUSTMENT_TYPES = ["fixed", "percentage"] as const

function createFormSchema(messages: ReturnType<typeof usePricingUiMessagesOrDefault>) {
  return z.object({
    optionPriceRuleId: z
      .string()
      .min(1, messages.optionStartTimeRuleDialog.validation.optionPriceRuleRequired),
    optionId: z.string().min(1, messages.optionStartTimeRuleDialog.validation.optionIdRequired),
    startTimeId: z
      .string()
      .min(1, messages.optionStartTimeRuleDialog.validation.startTimeIdRequired),
    ruleMode: z.enum(RULE_MODES),
    adjustmentType: z.enum(ADJUSTMENT_TYPES).optional().nullable(),
    sellAdjustment: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
    costAdjustment: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
    adjustmentPercent: z.coerce.number().min(0).max(100).optional().or(z.literal("")).nullable(),
    active: z.boolean(),
    notes: z.string().optional().nullable(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: OptionStartTimeRuleRecord
  onSuccess?: (rule: OptionStartTimeRuleRecord) => void
}

const toCents = (value: number | "" | null | undefined): number | null =>
  typeof value === "number" ? Math.round(value * 100) : null
const toBasisPoints = (value: number | "" | null | undefined): number | null =>
  typeof value === "number" ? Math.round(value * 100) : null

export function OptionStartTimeRuleDialog({ open, onOpenChange, rule, onSuccess }: Props) {
  const isEditing = !!rule
  const { create, update } = useOptionStartTimeRuleMutation()
  const messages = usePricingUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      optionPriceRuleId: "",
      optionId: "",
      startTimeId: "",
      ruleMode: "included",
      adjustmentType: null,
      sellAdjustment: "",
      costAdjustment: "",
      adjustmentPercent: "",
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && rule) {
      form.reset({
        optionPriceRuleId: rule.optionPriceRuleId,
        optionId: rule.optionId,
        startTimeId: rule.startTimeId,
        ruleMode: rule.ruleMode,
        adjustmentType: rule.adjustmentType,
        sellAdjustment: rule.sellAdjustmentCents != null ? rule.sellAdjustmentCents / 100 : "",
        costAdjustment: rule.costAdjustmentCents != null ? rule.costAdjustmentCents / 100 : "",
        adjustmentPercent:
          rule.adjustmentBasisPoints != null ? rule.adjustmentBasisPoints / 100 : "",
        active: rule.active,
        notes: rule.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, rule])

  const watchedMode = form.watch("ruleMode")
  const showAdjustment = watchedMode === "adjustment" || watchedMode === "override"

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      optionPriceRuleId: values.optionPriceRuleId,
      optionId: values.optionId,
      startTimeId: values.startTimeId,
      ruleMode: values.ruleMode,
      adjustmentType: showAdjustment ? values.adjustmentType || null : null,
      sellAdjustmentCents: showAdjustment ? toCents(values.sellAdjustment) : null,
      costAdjustmentCents: showAdjustment ? toCents(values.costAdjustment) : null,
      adjustmentBasisPoints: showAdjustment ? toBasisPoints(values.adjustmentPercent) : null,
      active: values.active,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: rule.id, input: payload })
      : await create.mutateAsync(payload)

    onSuccess?.(saved)
    onOpenChange(false)
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? messages.optionStartTimeRuleDialog.titles.edit
              : messages.optionStartTimeRuleDialog.titles.create}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{messages.optionStartTimeRuleDialog.fields.optionPriceRule}</Label>
              <OptionPriceRuleCombobox
                value={form.watch("optionPriceRuleId")}
                onChange={(value) =>
                  form.setValue("optionPriceRuleId", value ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                disabled={isEditing}
              />
              {form.formState.errors.optionPriceRuleId ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.optionPriceRuleId.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.optionStartTimeRuleDialog.fields.optionId}</Label>
                <ProductOptionCombobox
                  value={form.watch("optionId")}
                  onChange={(value) =>
                    form.setValue("optionId", value ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  requireProduct={false}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.optionStartTimeRuleDialog.fields.startTimeId}</Label>
                <Input
                  {...form.register("startTimeId")}
                  placeholder={messages.optionStartTimeRuleDialog.placeholders.startTimeId}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.optionStartTimeRuleDialog.fields.ruleMode}</Label>
                <Select
                  items={RULE_MODES.map((mode) => ({
                    label: messages.common.startTimeRuleModeLabels[mode as StartTimeRuleMode],
                    value: mode,
                  }))}
                  value={form.watch("ruleMode")}
                  onValueChange={(value) => form.setValue("ruleMode", value as RuleMode)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {messages.common.startTimeRuleModeLabels[mode as StartTimeRuleMode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showAdjustment ? (
                <div className="flex flex-col gap-2">
                  <Label>{messages.optionStartTimeRuleDialog.fields.adjustmentType}</Label>
                  <Select
                    items={ADJUSTMENT_TYPES.map((type) => ({
                      label: messages.common.adjustmentTypeLabels[type],
                      value: type,
                    }))}
                    value={form.watch("adjustmentType") ?? ""}
                    onValueChange={(value) =>
                      form.setValue(
                        "adjustmentType",
                        (value || null) as FormValues["adjustmentType"],
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={messages.optionStartTimeRuleDialog.placeholders.select}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {messages.common.adjustmentTypeLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            {showAdjustment ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>{messages.optionStartTimeRuleDialog.fields.sellAdjustment}</Label>
                  <Input {...form.register("sellAdjustment")} type="number" step="0.01" min="0" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{messages.optionStartTimeRuleDialog.fields.costAdjustment}</Label>
                  <Input {...form.register("costAdjustment")} type="number" step="0.01" min="0" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{messages.optionStartTimeRuleDialog.fields.adjustmentPercent}</Label>
                  <Input
                    {...form.register("adjustmentPercent")}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
              <Label>{messages.optionStartTimeRuleDialog.fields.active}</Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.optionStartTimeRuleDialog.fields.notes}</Label>
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
                : messages.optionStartTimeRuleDialog.actions.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
